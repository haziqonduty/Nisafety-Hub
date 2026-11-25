/** "navy" = neutral (unknown / retired categories); "iris" = Training. */
export type CategoryTone = "teal" | "amber" | "navy" | "iris";

export const CATEGORY_GROUPS = [
  {
    group: "Industrial Hygiene",
    tone: "teal" as CategoryTone,
    categories: [
      "Chemical Health Risk Assessment (CHRA)",
      "Additional Chemical Health Risk Assessment (Add.CHRA)",
      "Chemical Exposure Monitoring (CEM)",
      "Medical Surveillance (MS)",
      "Local Exhaust Ventilation (LEV)",
      "Noise Risk Assessment (NRA)",
      "Additional Noise Risk Assessment (Add.NRA)",
      "Noise Control Programme Assessment (NCPA)",
      "Audiometric (Baseline/Annual)",
      "Audiometric (Medical Examination/Diagnostic-PTA)",
      "Initial Ergonomic Risk Assessment (IERA)",
      "Advanced Ergonomic Risk Assessment (AERA)",
      "Hazard Identification, Risk Assessment and Risk Control (HIRARC)",
      "Indoor Air Quality (IAQ) Testing",
      "Control of Industrial Major Accident Hazards (CIMAH)",
      "Psychosocial Assessment",
      "Chemical Registration",
      "Chemical Classification",
    ],
  },
  {
    group: "Environmental Monitoring",
    tone: "amber" as CategoryTone,
    categories: [
      "Boundary Noise Monitoring",
      "Ambient Air Quality Monitoring",
      "Environmental Compliance Audit",
      "Drinking Water Analysis",
      "DOE Written Notification (WN) & Written Declaration (WD)",
      "Stack Emission Monitoring",
      "Genset Monitoring",
      "Waste Water Analysis",
      "Scheduled Waste Testing",
    ],
  },
  {
    group: "Training",
    tone: "iris" as CategoryTone,
    categories: ["Training"],
  },
] as const;

export const DOCUMENT_CATEGORIES = CATEGORY_GROUPS.flatMap((group) => group.categories);

/**
 * The key of a service's name under `categories.items` in messages/*.json.
 * next-intl reads "." in a key as nesting, so "Additional Noise Risk
 * Assessment (Add.NRA)" is stored as "...(Add_NRA)". ALWAYS look service
 * names up through this: tCategories(categoryMessageKey(category)).
 */
export function categoryMessageKey(category: string) {
  return category.replaceAll(".", "_");
}

const CATEGORY_TONES: Record<string, CategoryTone> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((group) => group.categories.map((category) => [category, group.tone])),
);

export function toneForCategory(category: string): CategoryTone {
  return CATEGORY_TONES[category] ?? "navy";
}

const TONE_BADGE_CLASSES: Record<CategoryTone, string> = {
  teal: "bg-accent-soft text-accent",
  amber: "bg-amber-soft text-amber",
  navy: "bg-badge-neutral-bg text-badge-neutral-text",
  iris: "bg-iris-soft text-iris",
};

export function toneBadgeClass(tone: CategoryTone) {
  return TONE_BADGE_CLASSES[tone];
}

const TONE_DOT_CLASSES: Record<CategoryTone, string> = {
  teal: "bg-accent",
  amber: "bg-amber",
  navy: "bg-badge-neutral-text",
  iris: "bg-iris",
};

export function toneDotClass(tone: CategoryTone) {
  return TONE_DOT_CLASSES[tone];
}

export function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^./]+$/, "");
}

export function extensionFromFileName(fileName: string) {
  return fileName.split(".").pop()?.toUpperCase() ?? "FILE";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const NEW_BADGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecentlySubmitted(isoDate: string) {
  return Date.now() - new Date(isoDate).getTime() < NEW_BADGE_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Service dates — the day a service was actually carried out, stored as a
// plain `date` (YYYY-MM-DD, no time or timezone). Nisafety operates in
// Malaysia, so "today" is always Kuala Lumpur's today, not the server's or
// the viewer's.

const SERVICE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_SERVICE_DATE = "2000-01-01";

export function todayInMalaysia() {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
}

/** A real calendar date, not before 2000 and not in the future (Malaysia time). */
export function isValidServiceDate(value: string) {
  if (!SERVICE_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  return value >= EARLIEST_SERVICE_DATE && value <= todayInMalaysia();
}

/**
 * Resolves a submitted expiry date. `raw === null` (field not sent) means
 * "use the category's default"; an empty string means "no fixed expiry";
 * anything else must be a real date after the service date (and before 2100).
 */
export function resolveExpiryInput(raw: string | null, serviceDate: string, fallback: string | null): { expiryDate: string | null } | { error: "INVALID_EXPIRY_DATE" } {
  if (raw === null) return { expiryDate: fallback };
  if (raw === "") return { expiryDate: null };
  if (!SERVICE_DATE_PATTERN.test(raw)) return { error: "INVALID_EXPIRY_DATE" };
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return { error: "INVALID_EXPIRY_DATE" };
  if (raw <= serviceDate || raw >= "2100-01-01") return { error: "INVALID_EXPIRY_DATE" };
  return { expiryDate: raw };
}

/** "12 Nov 2026" — formatted in UTC so a date-only value never shifts a day. */
export function formatServiceDate(value: string, locale = "en-GB") {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

// A bracket holds an abbreviation when it's one word with at least two capitals
// in a row ("CHRA", "WN", "Add.NRA", "Add.CHRA"); "(Baseline/Annual)" or "(Asas/Tahunan)"
// is part of the service's name.
const ABBREVIATION = /\s*\(((?=[^)]*[A-Z]{2})[A-Za-z0-9&.-]+)\)/g;

/**
 * "CHRA" from "Chemical Health Risk Assessment (CHRA)", "IAQ" from "Indoor
 * Air Quality (IAQ) Testing", "WN/WD" from "DOE Written Notification (WN) &
 * Written Declaration (WD)"; the full name when there's no abbreviation, e.g.
 * "Audiometric (Baseline/Annual)".
 */
export function shortCategoryLabel(label: string) {
  const abbreviations = [...label.matchAll(ABBREVIATION)].map((match) => match[1]);
  return abbreviations.length > 0 ? abbreviations.join("/") : label;
}

/** The category name with its abbreviations removed — shown next to the short label. */
export function categoryNameWithoutAbbreviation(label: string) {
  return label.replace(ABBREVIATION, "").replace(/\s+/g, " ").trim();
}
