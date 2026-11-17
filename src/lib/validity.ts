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
  /** The rule in one line, with the exact clause where the law states it. */
  basis: string;
  confidence: "regulation" | "practice";
  /** Where staff can read it for themselves. */
  source: { label: string; url: string };
};

// Every link below was opened and checked on 2026-11-17. The statutory
// clauses were read in the regulation text itself (USECHH 2000, Noise 2019).
const USECHH = {
  label: "USECHH Regulations 2000 (P.U.(A) 131/2000)",
  url: "https://medicine.um.edu.my/pdf/OSHE/resources/5.%20Regulations/OSHA%20USE%20AND%20STANDARDS%20OF%20EXPOSURE%20OF%20CHEMICALS%20HAZARDOUS%20TO%20HEALTH%20(USECHH)%20Regulation%202000.pdf",
};
const NOISE = {
  label: "Noise Exposure Regulations 2019 (P.U.(A) 60/2019), DOSH",
  url: "https://dosh.gov.my/wp-content/uploads/2025/10/PUA_20190301_PUA60_Noise-Exposure-Regs.-2019.pdf",
};
const CLEAN_AIR = {
  label: "Clean Air Regulations 2014 (P.U.(A) 151/2014)",
  url: "https://leap.unep.org/en/countries/my/national-legislation/environmental-quality-clean-air-regulations-2014",
};
const EFFLUENT = {
  label: "Industrial Effluent Regulations 2009",
  url: "https://leap.unep.org/en/countries/my/national-legislation/environmental-quality-industrial-effluent-regulations-2009",
};
const DOE = { label: "Department of Environment (DOE)", url: "https://www.doe.gov.my/" };

export const VALIDITY_RULES: Record<string, ValidityRule> = {
  // Industrial Hygiene (DOSH)
  "Chemical Health Risk Assessment (CHRA)": { months: 60, basis: "USECHH Regulations 2000, reg. 10(b) · review when 5 years have passed since the last assessment", confidence: "regulation", source: USECHH },
  "Chemical Exposure Monitoring (CEM)": { months: 6, basis: "USECHH Regulations 2000, reg. 26(2) · every 6 months or less for Schedule II chemicals, or as the assessor sets", confidence: "regulation", source: USECHH },
  "Medical Surveillance (MS)": { months: 12, basis: "USECHH Regulations 2000, reg. 27(3) · every 12 months or less for Schedule II chemicals", confidence: "regulation", source: USECHH },
  "Local Exhaust Ventilation (LEV)": { months: 12, basis: "USECHH Regulations 2000, reg. 17(1)(b) · examined and tested every 12 months or less", confidence: "regulation", source: USECHH },
  "Noise Risk Assessment (NRA)": { months: 60, basis: "Noise Exposure Regulations 2019, reg. 4(8)(a) · review within 5 years of the previous assessment", confidence: "regulation", source: NOISE },
  "Audiometric Testing": { months: 12, basis: "Noise Exposure Regulations 2019, reg. 9(1) · annually for employees exposed above the limit", confidence: "regulation", source: NOISE },
  "Ergonomic Risk Assessment (ERA)": { months: null, basis: "DOSH ERA Guidelines 2017 · review when the work changes", confidence: "practice", source: { label: "DOSH ergonomics guidelines", url: "https://dosh.gov.my/en/ergonomik/" } },
  "Hazard Identification, Risk Assessment and Risk Control (HIRARC)": { months: null, basis: "DOSH HIRARC Guidelines 2008 · review when the work changes", confidence: "practice", source: { label: "DOSH HIRARC Guidelines 2008", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/guidelines/hirarc-2/1846-01-guidelines-for-hazard-identification-risk-assessment-and-risk-control-hirarc-2008" } },
  "Indoor Air Quality (IAQ) Testing": { months: null, basis: "ICOP on Indoor Air Quality 2010 · interval set by the employer's IAQ programme", confidence: "practice", source: { label: "DOSH ICOP on Indoor Air Quality 2010", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/codes-of-practice/chemical-management/594-02-industry-code-of-practice-on-indoor-air-quality-2010" } },
  "Control of Industrial Major Accident Hazards (CIMAH)": { months: 36, basis: "CIMAH Regulations 1996 · safety report commonly updated every 3 years (not yet checked in the regulation text)", confidence: "practice", source: { label: "CIMAH Regulations 1996 (P.U.(A) 39/1996), DOSH", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/regulations/regulations-under-occupational-safety-and-health-act-1994-act-514/527-07-occupational-safety-and-health-control-of-industrial-major-accident-hazards-regulations-1996" } },
  "Psychosocial Assessment": { months: null, basis: "DOSH Psychosocial Guidelines 2024 · no fixed interval; review when the work changes", confidence: "practice", source: { label: "DOSH Psychosocial Risk Guidelines 2024", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/guidelines/occupational-health-1/4850-guidelines-on-psychosocial-risk-assessment-and-management-at-the-workplace-2024" } },
  // Environmental Monitoring (DOE)
  "Boundary Noise Monitoring": { months: 3, basis: "Set by the client's DOE approval conditions · commonly quarterly", confidence: "practice", source: DOE },
  "Ambient Air Quality Monitoring": { months: 3, basis: "Set by the client's DOE approval conditions · commonly quarterly", confidence: "practice", source: DOE },
  "Environmental Compliance Audit": { months: 12, basis: "Set by the client's DOE approval conditions · commonly annual", confidence: "practice", source: DOE },
  "Drinking Water Analysis": { months: null, basis: "MOH drinking water standard · frequency set by the premises' water-safety programme", confidence: "practice", source: { label: "MOH National Standard for Drinking Water Quality", url: "https://faolex.fao.org/docs/pdf/mal189903.pdf" } },
  "DOE Written Notification (WN) & Written Declaration (WD)": { months: null, basis: "Industrial Effluent Regulations 2009 · one-off submission to DOE, no renewal", confidence: "practice", source: EFFLUENT },
  "Stack Emission Monitoring": { months: 12, basis: "Clean Air Regulations 2014 · frequency set in the DOE licence, commonly yearly", confidence: "practice", source: CLEAN_AIR },
  "Genset Monitoring": { months: 12, basis: "Clean Air Regulations 2014 · frequency set in the DOE licence, commonly yearly", confidence: "practice", source: CLEAN_AIR },
  "Waste Water Analysis": { months: null, basis: "Industrial Effluent Regulations 2009 · frequency set by the licence conditions", confidence: "practice", source: EFFLUENT },
  "Scheduled Waste Testing": { months: null, basis: "Scheduled Wastes Regulations 2005 · as required for each waste stream", confidence: "practice", source: { label: "Scheduled Wastes Regulations 2005", url: "https://leap.unep.org/en/countries/my/national-legislation/environmental-quality-scheduled-wastes-regulations-2005-pua" } },
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
