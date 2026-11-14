export type CategoryTone = "teal" | "amber" | "navy";

export const CATEGORY_GROUPS = [
  {
    group: "Industrial Hygiene",
    tone: "teal" as CategoryTone,
    categories: [
      "Chemical Health Risk Assessment (CHRA)",
      "Chemical Exposure Monitoring (CEM)",
      "Medical Surveillance (MS)",
      "Local Exhaust Ventilation (LEV)",
      "Noise Risk Assessment (NRA)",
      "Audiometric Testing",
      "Ergonomic Risk Assessment (ERA)",
      "Hazard Identification, Risk Assessment and Risk Control (HIRARC)",
      "Indoor Air Quality (IAQ) Testing",
      "Control of Industrial Major Accident Hazards (CIMAH)",
      "Psychosocial Assessment",
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
] as const;

export const DOCUMENT_CATEGORIES = CATEGORY_GROUPS.flatMap((group) => group.categories);

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
};

export function toneBadgeClass(tone: CategoryTone) {
  return TONE_BADGE_CLASSES[tone];
}

const TONE_DOT_CLASSES: Record<CategoryTone, string> = {
  teal: "bg-accent",
  amber: "bg-amber",
  navy: "bg-badge-neutral-text",
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

/** "12 Nov 2026" — formatted in UTC so a date-only value never shifts a day. */
export function formatServiceDate(value: string, locale = "en-GB") {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * "CHRA" from "Chemical Health Risk Assessment (CHRA)", "IAQ" from "Indoor
 * Air Quality (IAQ) Testing", "WN/WD" from "DOE Written Notification (WN) &
 * Written Declaration (WD)"; the full name when there's no abbreviation.
 */
export function shortCategoryLabel(label: string) {
  const abbreviations = [...label.matchAll(/\(([^()]+)\)/g)].map((match) => match[1]);
  return abbreviations.length > 0 ? abbreviations.join("/") : label;
}

/** The category name with its abbreviations removed — shown next to the short label. */
export function categoryNameWithoutAbbreviation(label: string) {
  return label.replace(/\s*\([^()]+\)/g, "").replace(/\s+/g, " ").trim();
}
