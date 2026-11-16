import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { addDays, addMonths, daysUntil, defaultExpiryFor, expiryStatus, validityProgress, VALIDITY_RULES } from "@/lib/validity";

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
    expect(defaultExpiryFor("Chemical Exposure Monitoring (CEM)", "2026-11-14")).toBe("2027-05-14");
    expect(defaultExpiryFor("Boundary Noise Monitoring", "2026-11-14")).toBe("2027-02-14");
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

  it("match the SQL backfill in the expiry migration (KEEP IN SYNC)", () => {
    const sql = readFileSync("supabase/migrations/20261114_add_document_expiry_date.sql", "utf8");
    const fromSql = Object.fromEntries([...sql.matchAll(/when '([^']+)' then (\d+)/g)].map((match) => [match[1], Number(match[2])]));
    const fromCode = Object.fromEntries(Object.entries(VALIDITY_RULES).filter(([, rule]) => rule.months !== null).map(([category, rule]) => [category, rule.months]));
    expect(fromSql).toEqual(fromCode);
  });
});
