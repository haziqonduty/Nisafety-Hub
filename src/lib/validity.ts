/**
 * How long each service's report stays valid before the client needs it
 * done again — drives the expiry date that's auto-filled on every report.
 *
 * `months: null` means there's no fixed statutory interval (review is
 * triggered by change, or set by the client's own programme/licence); staff
 * can still enter an expiry date by hand on any report.
 *
 * `confidence`:
 *  - "regulation": the interval is stated in (or directly derived from) the
 *    cited Malaysian regulation / DOSH guideline.
 *  - "practice": the interval actually comes from the client's DOE licence /
 *    approval conditions or the CHRA's recommendation; the value here is the
 *    common default and should be confirmed per client.
 *
 * Nisafety should confirm this table against the current regulation texts —
 * it was compiled from DOSH/DOE guidance and industry summaries, not legal
 * advice. KEEP IN SYNC with the backfill in
 * supabase/migrations/20261114_add_document_expiry_date.sql.
 */
export type ValidityRule = {
  months: number | null;
  basis: string;
  confidence: "regulation" | "practice";
};

export const VALIDITY_RULES: Record<string, ValidityRule> = {
  // Industrial Hygiene (DOSH)
  "Chemical Health Risk Assessment (CHRA)": { months: 60, basis: "USECHH Regulations 2000 · CHRA review within 5 years", confidence: "regulation" },
  "Chemical Exposure Monitoring (CEM)": { months: 6, basis: "USECHH Regulations 2000 · repeat at intervals ≤ 6 months", confidence: "regulation" },
  "Medical Surveillance (MS)": { months: 12, basis: "USECHH Regulations 2000 · annual medical surveillance", confidence: "regulation" },
  "Local Exhaust Ventilation (LEV)": { months: 12, basis: "USECHH Regulations 2000 · examine & test every 12 months", confidence: "regulation" },
  "Noise Risk Assessment (NRA)": { months: 60, basis: "Noise Exposure Regulations 2019 · review within 5 years", confidence: "practice" },
  "Audiometric Testing": { months: 12, basis: "Noise Exposure Regulations 2019 · annual audiometric test", confidence: "regulation" },
  "Ergonomic Risk Assessment (ERA)": { months: null, basis: "DOSH ERA Guidelines 2017 · review when work changes", confidence: "practice" },
  "Hazard Identification, Risk Assessment and Risk Control (HIRARC)": { months: null, basis: "DOSH HIRARC Guidelines 2008 · review when work changes", confidence: "practice" },
  "Indoor Air Quality (IAQ) Testing": { months: null, basis: "ICOP IAQ 2010 · interval set by the employer's IAQ programme", confidence: "practice" },
  "Control of Industrial Major Accident Hazards (CIMAH)": { months: 36, basis: "CIMAH Regulations 1996 · update safety report every 3 years", confidence: "practice" },
  "Psychosocial Assessment": { months: null, basis: "No fixed statutory interval", confidence: "practice" },
  // Environmental Monitoring (DOE)
  "Boundary Noise Monitoring": { months: 3, basis: "DOE approval conditions · commonly quarterly", confidence: "practice" },
  "Ambient Air Quality Monitoring": { months: 3, basis: "DOE approval conditions · commonly quarterly", confidence: "practice" },
  "Environmental Compliance Audit": { months: 12, basis: "DOE approval conditions · commonly annual", confidence: "practice" },
  "Drinking Water Analysis": { months: null, basis: "Set by the premises' water-safety programme", confidence: "practice" },
  "DOE Written Notification (WN) & Written Declaration (WD)": { months: null, basis: "One-off submission · no renewal", confidence: "practice" },
  "Stack Emission Monitoring": { months: 12, basis: "Clean Air Regulations 2014 · periodic monitoring at least yearly", confidence: "regulation" },
  "Genset Monitoring": { months: 12, basis: "Clean Air Regulations 2014 · periodic monitoring at least yearly", confidence: "practice" },
  "Waste Water Analysis": { months: null, basis: "Industrial Effluent Regulations 2009 · per licence conditions", confidence: "practice" },
  "Scheduled Waste Testing": { months: null, basis: "Scheduled Wastes Regulations 2005 · as required per waste stream", confidence: "practice" },
};

export function validityRuleFor(category: string): ValidityRule | null {
  return VALIDITY_RULES[category] ?? null;
}

/** Adds calendar months to a YYYY-MM-DD date, clamping to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const target = new Date(`${date}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() + days);
  return target.toISOString().slice(0, 10);
}

/** The auto-filled expiry for a service done on `serviceDate`, or null when there's no fixed interval. */
export function defaultExpiryFor(category: string, serviceDate: string) {
  const rule = validityRuleFor(category);
  if (!rule?.months || !serviceDate) return null;
  return addMonths(serviceDate, rule.months);
}

export const EXPIRING_SOON_DAYS = 30;
export const UPCOMING_DAYS = 90;

export type ExpiryStatus = "expired" | "expiring" | "upcoming" | "valid" | "none" | "renewed";

export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Status of one report's expiry relative to today (Malaysia). A superseded report is "renewed". */
export function expiryStatus(expiryDate: string | null, today: string, superseded = false): { status: ExpiryStatus; daysLeft: number | null } {
  if (superseded) return { status: "renewed", daysLeft: null };
  if (!expiryDate) return { status: "none", daysLeft: null };
  const daysLeft = daysUntil(expiryDate, today);
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { status: "expiring", daysLeft };
  if (daysLeft <= UPCOMING_DAYS) return { status: "upcoming", daysLeft };
  return { status: "valid", daysLeft };
}

/** How far through its validity window a report is, 0–1 (for progress bars). */
export function validityProgress(serviceDate: string, expiryDate: string, today: string) {
  const total = daysUntil(expiryDate, serviceDate);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, daysUntil(today, serviceDate) / total));
}

export const EXPIRY_STATUS_STYLES: Record<ExpiryStatus, { chip: string; dot: string; bar: string }> = {
  expired: { chip: "bg-danger-soft text-danger", dot: "bg-danger", bar: "bg-danger" },
  expiring: { chip: "bg-amber-soft text-amber", dot: "bg-amber", bar: "bg-amber" },
  upcoming: { chip: "bg-badge-neutral-bg text-badge-neutral-text", dot: "bg-amber/70", bar: "bg-accent" },
  valid: { chip: "bg-accent-soft text-accent", dot: "bg-accent", bar: "bg-accent" },
  none: { chip: "bg-badge-neutral-bg text-badge-neutral-text", dot: "bg-ink-faint", bar: "bg-line" },
  renewed: { chip: "bg-badge-neutral-bg text-badge-neutral-text", dot: "bg-ink-faint", bar: "bg-line" },
};
