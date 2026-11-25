/**
 * Sales person and main contractor ("maincon") of a job. Stored on every
 * report of the visit. KEEP IN SYNC with the length checks in
 * supabase/migrations/20261125_report_sales_person_maincon.sql.
 */
export const MAX_SALES_PERSON_LENGTH = 120;
export const MAX_MAINCON_LENGTH = 160;

export type JobDetails = { salesPerson: string; maincon: string };

export const EMPTY_JOB_DETAILS: JobDetails = { salesPerson: "", maincon: "" };

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

/** Adds the job details to a report's form data (blank maincon = direct job). */
export function appendJobDetails(formData: FormData, job: JobDetails) {
  formData.append("salesPerson", job.salesPerson);
  formData.append("maincon", job.maincon);
}

/**
 * Reads the job details from a report request. `requireSalesPerson` is set
 * for every NEW report; edits of older reports may leave it blank.
 * Returns null values for blanks, ready for the database.
 */
export function readJobDetails(
  formData: FormData,
  { requireSalesPerson }: { requireSalesPerson: boolean },
): { salesPerson: string | null; maincon: string | null } | { error: "MISSING_SALES_PERSON" } {
  const salesPerson = clean(formData.get("salesPerson"), MAX_SALES_PERSON_LENGTH);
  const maincon = clean(formData.get("maincon"), MAX_MAINCON_LENGTH);
  if (requireSalesPerson && !salesPerson) return { error: "MISSING_SALES_PERSON" };
  return { salesPerson: salesPerson || null, maincon: maincon || null };
}
