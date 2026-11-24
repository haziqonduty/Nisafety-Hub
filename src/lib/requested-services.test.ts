import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { cleanRequestedServices, MAX_REQUESTED_SERVICES, outstandingServices } from "@/lib/requested-services";

const CHRA = "Chemical Health Risk Assessment (CHRA)";
const LEV = "Local Exhaust Ventilation (LEV)";

describe("cleanRequestedServices", () => {
  it("keeps known categories once, in the standard order", () => {
    expect(cleanRequestedServices([LEV, CHRA, LEV])).toEqual([CHRA, LEV]);
  });

  it("drops unknown values and non-arrays", () => {
    expect(cleanRequestedServices([CHRA, "Made up service", 42])).toEqual([CHRA]);
    expect(cleanRequestedServices("CHRA")).toEqual([]);
    expect(cleanRequestedServices(null)).toEqual([]);
  });
});

describe("outstandingServices", () => {
  it("hides services that already have a report", () => {
    expect(outstandingServices([CHRA, LEV], [LEV, null])).toEqual([CHRA]);
    expect(outstandingServices(null, [])).toEqual([]);
  });
});

describe("requested services cap", () => {
  it("fits every service and matches the database check", () => {
    expect(MAX_REQUESTED_SERVICES).toBeGreaterThanOrEqual(DOCUMENT_CATEGORIES.length);
    const sql = readFileSync("supabase/migrations/20261124_service_types_and_chemical_services.sql", "utf8");
    expect(sql).toContain(`cardinality(requested_services) <= ${MAX_REQUESTED_SERVICES}`);
    expect(cleanRequestedServices([...DOCUMENT_CATEGORIES])).toHaveLength(DOCUMENT_CATEGORIES.length);
  });
});
