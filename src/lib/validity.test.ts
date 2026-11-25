import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { addDays, addMonths, daysUntil, defaultExpiryFor, expiryStatus, isRenewalCloseReason, RENEWAL_CLOSE_REASONS, validityProgress, VALIDITY_RULES } from "@/lib/validity";

describe("addMonths", () => {
  it("adds calendar months", () => {
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
    expect(addMonths("2026-11-14", 60)).toBe("2031-11-14");
  });
  it("clamps to the end of a shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2027-01-31", 13)).toBe("2028-02-29"); // leap year
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
  });
  it("rolls over the year", () => {
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("addDays / daysUntil", () => {
  it("are inverse and timezone-safe", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysUntil("2026-11-20", "2026-11-14")).toBe(6);
    expect(daysUntil("2026-11-14", "2026-11-20")).toBe(-6);
  });
});

describe("defaultExpiryFor", () => {
  it("uses the category's validity period", () => {
    expect(defaultExpiryFor("Chemical Health Risk Assessment (CHRA)", "2026-11-14")).toBe("2031-11-14");
    expect(defaultExpiryFor("Chemical Exposure Monitoring (CEM)", "2026-11-14")).toBe("2027-11-14");
    expect(defaultExpiryFor("Boundary Noise Monitoring", "2026-11-14")).toBe("2027-11-14");
    expect(defaultExpiryFor("Medical Surveillance (MS)", "2026-11-14")).toBe("2027-11-14");
  });
  it("is null with no fixed interval, unknown category or no date", () => {
    expect(defaultExpiryFor("Indoor Air Quality (IAQ) Testing", "2026-11-14")).toBeNull();
    expect(defaultExpiryFor("Not a real category", "2026-11-14")).toBeNull();
    expect(defaultExpiryFor("Chemical Health Risk Assessment (CHRA)", "")).toBeNull();
  });
});

describe("expiryStatus", () => {
  const today = "2026-11-16";
  it("classifies by days left", () => {
    expect(expiryStatus("2026-11-15", today)).toEqual({ status: "expired", daysLeft: -1 });
    expect(expiryStatus("2026-11-16", today)).toEqual({ status: "expiring", daysLeft: 0 });
    expect(expiryStatus("2026-12-16", today)).toEqual({ status: "expiring", daysLeft: 30 });
    expect(expiryStatus("2026-12-17", today)).toEqual({ status: "upcoming", daysLeft: 31 });
    expect(expiryStatus("2027-02-14", today)).toEqual({ status: "upcoming", daysLeft: 90 });
    expect(expiryStatus("2027-02-15", today)).toEqual({ status: "valid", daysLeft: 91 });
  });
  it("handles no expiry and superseded reports", () => {
    expect(expiryStatus(null, today).status).toBe("none");
    expect(expiryStatus("2020-01-01", today, true).status).toBe("renewed");
  });
  it("is closed when staff marked action taken, whatever the date (renewed still wins)", () => {
    expect(expiryStatus("2020-01-01", today, false, true)).toEqual({ status: "closed", daysLeft: null });
    expect(expiryStatus(null, today, false, true).status).toBe("closed");
    expect(expiryStatus("2020-01-01", today, true, true).status).toBe("renewed");
  });
});

describe("validityProgress", () => {
  it("is the share of the validity window already used, clamped to 0–1", () => {
    expect(validityProgress("2026-01-01", "2027-01-01", "2026-07-02")).toBeCloseTo(0.5, 2);
    expect(validityProgress("2026-01-01", "2027-01-01", "2025-06-01")).toBe(0);
    expect(validityProgress("2026-01-01", "2027-01-01", "2028-01-01")).toBe(1);
  });
});

describe("validity rules", () => {
  it("cover every service category", () => {
    const missing = DOCUMENT_CATEGORIES.filter((category) => !(category in VALIDITY_RULES));
    expect(missing).toEqual([]);
  });

  it("match the SQL backfill in the expiry migration, following later renames and interval changes (KEEP IN SYNC)", () => {
    const sql = readFileSync("supabase/migrations/20261114_add_document_expiry_date.sql", "utf8");
    const renameSql = readFileSync("supabase/migrations/20261124_service_types_and_chemical_services.sql", "utf8");
    const intervalSql = readFileSync("supabase/migrations/20261125_cem_boundary_noise_one_year.sql", "utf8");
    const renames = new Map([...renameSql.matchAll(/rename '([^']+)' -> '([^']+)'/g)].map((match) => [match[1], match[2]]));
    const fromSql: Record<string, number> = Object.fromEntries([...sql.matchAll(/when '([^']+)' then (\d+)/g)].map((match) => [renames.get(match[1]) ?? match[1], Number(match[2])]));
    for (const match of intervalSql.matchAll(/interval '([^']+)' -> (\d+)/g)) fromSql[match[1]] = Number(match[2]);
    // Fixed-interval services added after the backfill ran (no old reports to backfill).
    const addedLater = ["Audiometric (Medical Examination/Diagnostic-PTA)"];
    const fromCode = Object.fromEntries(
      Object.entries(VALIDITY_RULES).filter(([category, rule]) => rule.months !== null && !addedLater.includes(category)).map(([category, rule]) => [category, rule.months]),
    );
    expect(fromSql).toEqual(fromCode);
  });

  it("match the category list in the latest database constraint (KEEP IN SYNC)", () => {
    const sql = readFileSync("supabase/migrations/20261124_service_types_and_chemical_services.sql", "utf8");
    const constraint = sql.slice(sql.indexOf("add constraint documents_category_check"));
    const fromSql = [...constraint.matchAll(/^\s+'([^']+)',?$/gm)].map((match) => match[1]);
    expect(fromSql).toEqual([...DOCUMENT_CATEGORIES]);
  });

  it("keep the agreed periods for the split and new services", () => {
    expect(VALIDITY_RULES["Initial Ergonomic Risk Assessment (IERA)"].months).toBeNull();
    expect(VALIDITY_RULES["Advanced Ergonomic Risk Assessment (AERA)"].months).toBeNull();
    expect(VALIDITY_RULES["Audiometric (Baseline/Annual)"].months).toBe(12);
    expect(VALIDITY_RULES["Audiometric (Medical Examination/Diagnostic-PTA)"].months).toBe(12);
    expect(VALIDITY_RULES["Noise Control Programme Assessment (NCPA)"].months).toBeNull();
    expect(VALIDITY_RULES["Chemical Registration"].months).toBeNull();
    expect(VALIDITY_RULES["Chemical Classification"].months).toBeNull();
    expect(VALIDITY_RULES["Chemical Exposure Monitoring (CEM)"].months).toBe(12);
    expect(VALIDITY_RULES["Boundary Noise Monitoring"].months).toBe(12);
  });
});

describe("validity rule sources", () => {
  it("every service links to an https source with a readable label", () => {
    for (const [category, rule] of Object.entries(VALIDITY_RULES)) {
      expect(rule.source.url, category).toMatch(/^https:\/\//);
      expect(rule.source.label.length, category).toBeGreaterThan(5);
    }
  });

  it("statutory rules quote the exact regulation clause", () => {
    for (const [category, rule] of Object.entries(VALIDITY_RULES)) {
      if (rule.confidence === "regulation") expect(rule.basis, category).toMatch(/reg\. \d+\(/);
    }
  });
});

describe("renewal close reasons", () => {
  it("accept only the known reasons", () => {
    expect(isRenewalCloseReason("other_consultant")).toBe(true);
    expect(isRenewalCloseReason("not_needed")).toBe(true);
    expect(isRenewalCloseReason("nope")).toBe(false);
    expect(isRenewalCloseReason(null)).toBe(false);
  });

  it("match the database check (KEEP IN SYNC)", () => {
    const sql = readFileSync("supabase/migrations/20261124_renewal_action_taken.sql", "utf8");
    const list = sql.match(/renewal_closed_reason in \(([^)]+)\)/)?.[1] ?? "";
    expect([...list.matchAll(/'([^']+)'/g)].map((match) => match[1])).toEqual([...RENEWAL_CLOSE_REASONS]);
  });
});
