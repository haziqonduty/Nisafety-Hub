import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanFileLabel, MAX_EXTRA_FILES, MAX_FILE_LABEL_LENGTH, MAX_FILES_PER_REPORT } from "@/lib/report-files";

describe("cleanFileLabel", () => {
  it("trims, single-spaces and cuts to length", () => {
    expect(cleanFileLabel("  Appendix   A  ")).toBe("Appendix A");
    expect(cleanFileLabel("x".repeat(200))).toHaveLength(MAX_FILE_LABEL_LENGTH);
  });

  it("returns empty for blanks and non-strings", () => {
    expect(cleanFileLabel("   ")).toBe("");
    expect(cleanFileLabel(null)).toBe("");
    expect(cleanFileLabel(42)).toBe("");
  });
});

describe("limits match the migration", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261126_report_extra_files.sql"), "utf8");

  it("extra files per report", () => {
    expect(MAX_EXTRA_FILES).toBe(MAX_FILES_PER_REPORT - 1);
    expect(sql).toContain(`>= ${MAX_EXTRA_FILES} then`);
    expect(sql).toContain(`position between 1 and ${MAX_EXTRA_FILES}`);
  });

  it("label length", () => {
    expect(sql).toContain(`char_length(file_label) between 1 and ${MAX_FILE_LABEL_LENGTH}`);
    expect(sql).toContain(`char_length(label) between 1 and ${MAX_FILE_LABEL_LENGTH}`);
  });
});
