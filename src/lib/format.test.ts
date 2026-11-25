import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_GROUPS, categoryMessageKey, categoryNameWithoutAbbreviation, DOCUMENT_CATEGORIES, formatServiceDate, isValidServiceDate, resolveExpiryInput, shortCategoryLabel, todayInMalaysia } from "@/lib/format";

describe("todayInMalaysia", () => {
  afterEach(() => vi.useRealTimers());
  it("uses Kuala Lumpur time (UTC+8), not the server's", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T16:30:00Z")); // 00:30 on the 16th in KL
    expect(todayInMalaysia()).toBe("2026-11-16");
    vi.setSystemTime(new Date("2026-11-15T15:59:00Z")); // 23:59 on the 15th in KL
    expect(todayInMalaysia()).toBe("2026-11-15");
  });
});

describe("isValidServiceDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T04:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("accepts real past dates and today", () => {
    expect(isValidServiceDate("2026-11-16")).toBe(true);
    expect(isValidServiceDate("2024-02-29")).toBe(true);
    expect(isValidServiceDate("2000-01-01")).toBe(true);
  });
  it("rejects the future, impossible dates, too-old dates and bad formats", () => {
    expect(isValidServiceDate("2026-11-17")).toBe(false);
    expect(isValidServiceDate("2026-02-30")).toBe(false);
    expect(isValidServiceDate("2025-02-29")).toBe(false);
    expect(isValidServiceDate("1999-12-31")).toBe(false);
    expect(isValidServiceDate("16/11/2026")).toBe(false);
    expect(isValidServiceDate("")).toBe(false);
  });
});

describe("resolveExpiryInput", () => {
  it("falls back to the default when the field wasn't sent", () => {
    expect(resolveExpiryInput(null, "2026-11-01", "2027-11-01")).toEqual({ expiryDate: "2027-11-01" });
  });
  it("treats an empty value as no fixed expiry", () => {
    expect(resolveExpiryInput("", "2026-11-01", "2027-11-01")).toEqual({ expiryDate: null });
  });
  it("accepts a real date after the monitoring date", () => {
    expect(resolveExpiryInput("2026-11-02", "2026-11-01", null)).toEqual({ expiryDate: "2026-11-02" });
  });
  it("rejects dates on/before monitoring, impossible, or absurdly far", () => {
    for (const raw of ["2026-11-01", "2026-10-01", "2027-02-30", "2100-01-01", "soon"]) {
      expect(resolveExpiryInput(raw, "2026-11-01", null)).toEqual({ error: "INVALID_EXPIRY_DATE" });
    }
  });
});

describe("formatServiceDate", () => {
  it("never shifts the day, whatever the timezone", () => {
    expect(formatServiceDate("2026-11-01")).toBe("01 Nov 2026");
    expect(formatServiceDate("2026-12-31")).toBe("31 Dec 2026");
  });
});

describe("category labels", () => {
  it("builds the short code from every abbreviation", () => {
    expect(shortCategoryLabel("Chemical Health Risk Assessment (CHRA)")).toBe("CHRA");
    expect(shortCategoryLabel("Indoor Air Quality (IAQ) Testing")).toBe("IAQ");
    expect(shortCategoryLabel("DOE Written Notification (WN) & Written Declaration (WD)")).toBe("WN/WD");
    expect(shortCategoryLabel("Initial Ergonomic Risk Assessment (IERA)")).toBe("IERA");
    expect(shortCategoryLabel("Noise Control Programme Assessment (NCPA)")).toBe("NCPA");
    expect(shortCategoryLabel("Chemical Registration")).toBe("Chemical Registration");
    expect(shortCategoryLabel("Additional Noise Risk Assessment (Add.NRA)")).toBe("Add.NRA");
    expect(categoryNameWithoutAbbreviation("Additional Noise Risk Assessment (Add.NRA)")).toBe("Additional Noise Risk Assessment");
    expect(shortCategoryLabel("Training")).toBe("Training");
  });
  it("keeps a bracket that is part of the name, not an abbreviation", () => {
    expect(shortCategoryLabel("Audiometric (Baseline/Annual)")).toBe("Audiometric (Baseline/Annual)");
    expect(shortCategoryLabel("Audiometric (Medical Examination/Diagnostic-PTA)")).toBe("Audiometric (Medical Examination/Diagnostic-PTA)");
    expect(shortCategoryLabel("Audiometrik (Asas/Tahunan)")).toBe("Audiometrik (Asas/Tahunan)");
    expect(shortCategoryLabel("Audit (Annual)")).toBe("Audit (Annual)");
    expect(categoryNameWithoutAbbreviation("Audiometric (Baseline/Annual)")).toBe("Audiometric (Baseline/Annual)");
  });
  it("strips abbreviations from the long name", () => {
    expect(categoryNameWithoutAbbreviation("Indoor Air Quality (IAQ) Testing")).toBe("Indoor Air Quality Testing");
    expect(categoryNameWithoutAbbreviation("DOE Written Notification (WN) & Written Declaration (WD)")).toBe("DOE Written Notification & Written Declaration");
  });
});

describe("service names in both languages", () => {
  const read = (locale: string) => JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")).categories as { groups: Record<string, string>; items: Record<string, string> };

  it("every service and group has an English and Malay name, looked up by categoryMessageKey", () => {
    for (const locale of ["en", "ms"]) {
      const { groups, items } = read(locale);
      const missing = DOCUMENT_CATEGORIES.filter((category) => !items[categoryMessageKey(category)]);
      expect(missing, locale).toEqual([]);
      expect(CATEGORY_GROUPS.filter((group) => !groups[group.group]).map((group) => group.group), locale).toEqual([]);
    }
  });

  it("no message key contains a dot (next-intl reads it as nesting)", () => {
    for (const locale of ["en", "ms"]) {
      expect(Object.keys(read(locale).items).filter((key) => key.includes(".")), locale).toEqual([]);
    }
  });

  it("keeps the dot in the stored name and the short code", () => {
    expect(categoryMessageKey("Additional Noise Risk Assessment (Add.NRA)")).toBe("Additional Noise Risk Assessment (Add_NRA)");
    expect(read("en").items[categoryMessageKey("Additional Noise Risk Assessment (Add.NRA)")]).toBe("Additional Noise Risk Assessment (Add.NRA)");
  });
});
