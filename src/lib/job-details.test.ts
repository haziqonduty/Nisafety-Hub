import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appendJobDetails, MAX_MAINCON_LENGTH, MAX_SALES_PERSON_LENGTH, readJobDetails } from "@/lib/job-details";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("readJobDetails", () => {
  it("requires a sales person on new reports", () => {
    expect(readJobDetails(form({ salesPerson: "  ", maincon: "" }), { requireSalesPerson: true })).toEqual({ error: "MISSING_SALES_PERSON" });
    expect(readJobDetails(form({}), { requireSalesPerson: true })).toEqual({ error: "MISSING_SALES_PERSON" });
  });

  it("tidies spaces and turns blanks into null", () => {
    expect(readJobDetails(form({ salesPerson: "  Adina   Fazil ", maincon: "" }), { requireSalesPerson: true })).toEqual({ salesPerson: "Adina Fazil", maincon: null });
    expect(readJobDetails(form({ salesPerson: "", maincon: " Acme  Builders " }), { requireSalesPerson: false })).toEqual({ salesPerson: null, maincon: "Acme Builders" });
  });

  it("caps the length", () => {
    const long = "x".repeat(500);
    const result = readJobDetails(form({ salesPerson: long, maincon: long }), { requireSalesPerson: true });
    expect(result).toEqual({ salesPerson: "x".repeat(MAX_SALES_PERSON_LENGTH), maincon: "x".repeat(MAX_MAINCON_LENGTH) });
  });

  it("round-trips with appendJobDetails", () => {
    const data = new FormData();
    appendJobDetails(data, { salesPerson: "Adina", maincon: "Acme" });
    expect(readJobDetails(data, { requireSalesPerson: true })).toEqual({ salesPerson: "Adina", maincon: "Acme" });
  });

  it("matches the database limits (KEEP IN SYNC)", () => {
    const sql = readFileSync("supabase/migrations/20261125_report_sales_person_maincon.sql", "utf8");
    expect(sql).toContain(`char_length(sales_person) between 1 and ${MAX_SALES_PERSON_LENGTH}`);
    expect(sql).toContain(`char_length(maincon) between 1 and ${MAX_MAINCON_LENGTH}`);
  });
});
