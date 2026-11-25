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
 * supabase/migrations/20261114_add_document_expiry_date.sql and later interval
 * changes (20261125_cem_boundary_noise_one_year.sql).
 */
export type ValidityRule = {
  months: number | null;
  /** The rule in one line, with the exact clause where the law states it. */
  basis: string;
  confidence: "regulation" | "practice";
  /** Where staff can read it for themselves. */
  source: { label: string; url: string };
};

// Every link below was opened and checked on 2026-11-17 (chemical links added 2026-11-24). The statutory
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
const ERGONOMICS = { label: "DOSH ergonomics guidelines", url: "https://dosh.gov.my/en/ergonomik/" };
const DOE = { label: "Department of Environment (DOE)", url: "https://www.doe.gov.my/" };

export const VALIDITY_RULES: Record<string, ValidityRule> = {
  // Industrial Hygiene (DOSH)
  "Chemical Health Risk Assessment (CHRA)": { months: 60, basis: "USECHH Regulations 2000, reg. 10(b) · review when 5 years have passed since the last assessment", confidence: "regulation", source: USECHH },
  "Additional Chemical Health Risk Assessment (Add.CHRA)": { months: 60, basis: "USECHH Regulations 2000 · further assessment on top of the CHRA; tracked on the same 5-year review as CHRA (reg. 10(b))", confidence: "practice", source: USECHH },
  "Chemical Exposure Monitoring (CEM)": { months: 12, basis: "USECHH Regulations 2000, reg. 26(2) · interval set in the CHRA, commonly yearly; Schedule II chemicals must be monitored every 6 months or less, so set that expiry by hand", confidence: "practice", source: USECHH },
  "Medical Surveillance (MS)": { months: 12, basis: "USECHH Regulations 2000, reg. 27(3) · every 12 months or less for Schedule II chemicals", confidence: "regulation", source: USECHH },
  "Local Exhaust Ventilation (LEV)": { months: 12, basis: "USECHH Regulations 2000, reg. 17(1)(b) · examined and tested every 12 months or less", confidence: "regulation", source: USECHH },
  "Noise Risk Assessment (NRA)": { months: 60, basis: "Noise Exposure Regulations 2019, reg. 4(8)(a) · review within 5 years of the previous assessment", confidence: "regulation", source: NOISE },
  "Additional Noise Risk Assessment (Add.NRA)": { months: 60, basis: "Noise Exposure Regulations 2019 · further assessment on top of the noise risk assessment; tracked on the same 5-year review as NRA (reg. 4(8)(a))", confidence: "practice", source: NOISE },
  "Noise Control Programme Assessment (NCPA)": { months: null, basis: "Noise Exposure Regulations 2019 · checks the employer's noise control measures; no fixed interval, repeat when the noise risk assessment or the work changes", confidence: "practice", source: NOISE },
  "Audiometric (Baseline/Annual)": { months: 12, basis: "Noise Exposure Regulations 2019, reg. 9(1) and 10(1)(b) · baseline within 3 months of starting work in the noisy area, then annually", confidence: "regulation", source: NOISE },
  "Audiometric (Medical Examination/Diagnostic-PTA)": { months: 12, basis: "Noise Exposure Regulations 2019, reg. 9(4)–(5) · medical examination by an occupational health doctor after an abnormal audiogram; repeated with the yearly audiometric programme", confidence: "practice", source: NOISE },
  "Initial Ergonomic Risk Assessment (IERA)": { months: null, basis: "DOSH ERA Guidelines 2017 · initial screening of ergonomic risk factors; review when the work changes", confidence: "practice", source: ERGONOMICS },
  "Advanced Ergonomic Risk Assessment (AERA)": { months: null, basis: "DOSH ERA Guidelines 2017 · detailed assessment where the initial ERA finds a risk; review when the work changes", confidence: "practice", source: ERGONOMICS },
  "Hazard Identification, Risk Assessment and Risk Control (HIRARC)": { months: null, basis: "DOSH HIRARC Guidelines 2008 · review when the work changes", confidence: "practice", source: { label: "DOSH HIRARC Guidelines 2008", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/guidelines/hirarc-2/1846-01-guidelines-for-hazard-identification-risk-assessment-and-risk-control-hirarc-2008" } },
  "Indoor Air Quality (IAQ) Testing": { months: null, basis: "ICOP on Indoor Air Quality 2010 · interval set by the employer's IAQ programme", confidence: "practice", source: { label: "DOSH ICOP on Indoor Air Quality 2010", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/codes-of-practice/chemical-management/594-02-industry-code-of-practice-on-indoor-air-quality-2010" } },
  "Control of Industrial Major Accident Hazards (CIMAH)": { months: 36, basis: "CIMAH Regulations 1996 · safety report commonly updated every 3 years (not yet checked in the regulation text)", confidence: "practice", source: { label: "CIMAH Regulations 1996 (P.U.(A) 39/1996), DOSH", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/regulations/regulations-under-occupational-safety-and-health-act-1994-act-514/527-07-occupational-safety-and-health-control-of-industrial-major-accident-hazards-regulations-1996" } },
  "Chemical Registration": { months: null, basis: "DOSH chemical management · register of the hazardous chemicals on site; no expiry, update when the chemicals change", confidence: "practice", source: { label: "DOSH chemical management", url: "https://dosh.gov.my/en/pengurusan-kimia/" } },
  "Chemical Classification": { months: null, basis: "CLASS Regulations 2013 · hazard classification of a chemical; no expiry, redo when the chemical or its formulation changes", confidence: "practice", source: { label: "CLASS Regulations 2013 (P.U.(A) 310/2013), DOSH", url: "https://dosh.gov.my/wp-content/uploads/2026/04/Occupational-Safety-and-Health-Classification-Labelling-and-Safety-Data-Sheet-of-Hazardous-Chemicals-Regulations-2013.pdf" } },
  "Psychosocial Assessment": { months: null, basis: "DOSH Psychosocial Guidelines 2024 · no fixed interval; review when the work changes", confidence: "practice", source: { label: "DOSH Psychosocial Risk Guidelines 2024", url: "https://intranet.dosh.gov.my/competent-person-form/occupational-health/regulation-2-1/guidelines/occupational-health-1/4850-guidelines-on-psychosocial-risk-assessment-and-management-at-the-workplace-2024" } },
  // Environmental Monitoring (DOE)
  "Boundary Noise Monitoring": { months: 12, basis: "Set by the client's DOE approval conditions · commonly yearly; follow the licence if it asks for more often", confidence: "practice", source: DOE },
  "Ambient Air Quality Monitoring": { months: 3, basis: "Set by the client's DOE approval conditions · commonly quarterly", confidence: "practice", source: DOE },
  "Environmental Compliance Audit": { months: 12, basis: "Set by the client's DOE approval conditions · commonly annual", confidence: "practice", source: DOE },
  "Drinking Water Analysis": { months: null, basis: "MOH drinking water standard · frequency set by the premises' water-safety programme", confidence: "practice", source: { label: "MOH National Standard for Drinking Water Quality", url: "https://faolex.fao.org/docs/pdf/mal189903.pdf" } },
  "DOE Written Notification (WN) & Written Declaration (WD)": { months: null, basis: "Industrial Effluent Regulations 2009 · one-off submission to DOE, no renewal", confidence: "practice", source: EFFLUENT },
  "Stack Emission Monitoring": { months: 12, basis: "Clean Air Regulations 2014 · frequency set in the DOE licence, commonly yearly", confidence: "practice", source: CLEAN_AIR },
  "Genset Monitoring": { months: 12, basis: "Clean Air Regulations 2014 · frequency set in the DOE licence, commonly yearly", confidence: "practice", source: CLEAN_AIR },
  "Waste Water Analysis": { months: null, basis: "Industrial Effluent Regulations 2009 · frequency set by the licence conditions", confidence: "practice", source: EFFLUENT },
  "Scheduled Waste Testing": { months: null, basis: "Scheduled Wastes Regulations 2005 · as required for each waste stream", confidence: "practice", source: { label: "Scheduled Wastes Regulations 2005", url: "https://leap.unep.org/en/countries/my/national-legislation/environmental-quality-scheduled-wastes-regulations-2005-pua" } },
  // Training
  "Training": { months: null, basis: "Training certificates · no fixed expiry; validity depends on the course, so set a custom date on the report if the certificate has one", confidence: "practice", source: { label: "NIOSH Malaysia (training)", url: "https://www.niosh.com.my/" } },
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

export type ExpiryStatus = "expired" | "expiring" | "upcoming" | "valid" | "none" | "renewed" | "closed";

/** Why staff closed a report's renewal ("Action taken"). KEEP IN SYNC with documents_renewal_closed_check. */
export const RENEWAL_CLOSE_REASONS = ["other_consultant", "not_needed", "other"] as const;
export type RenewalCloseReason = (typeof RENEWAL_CLOSE_REASONS)[number];

export function isRenewalCloseReason(value: unknown): value is RenewalCloseReason {
  return typeof value === "string" && (RENEWAL_CLOSE_REASONS as readonly string[]).includes(value);
}

export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/**
 * Status of one report's expiry relative to today (Malaysia). A superseded
 * report is "renewed"; one whose renewal staff closed ("Action taken") is "closed".
 */
export function expiryStatus(expiryDate: string | null, today: string, superseded = false, closed = false): { status: ExpiryStatus; daysLeft: number | null } {
  if (superseded) return { status: "renewed", daysLeft: null };
  if (closed) return { status: "closed", daysLeft: null };
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
  closed: { chip: "bg-badge-neutral-bg text-badge-neutral-text", dot: "bg-ink-faint", bar: "bg-line" },
};
