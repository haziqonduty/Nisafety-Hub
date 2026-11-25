/**
 * A service report can carry more than one document: the main file plus up
 * to 9 extras, each with its own name/remark. KEEP IN SYNC with
 * supabase/migrations/20261126_report_extra_files.sql.
 */
export const MAX_FILES_PER_REPORT = 10;
export const MAX_EXTRA_FILES = MAX_FILES_PER_REPORT - 1;
export const MAX_FILE_LABEL_LENGTH = 120;

/** Trimmed, single-spaced and cut to length; "" when blank. */
export function cleanFileLabel(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_FILE_LABEL_LENGTH) : "";
}
