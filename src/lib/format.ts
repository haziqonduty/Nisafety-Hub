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
