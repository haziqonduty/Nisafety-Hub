import { describe, expect, it } from "vitest";
import { cleanRequestedServices, outstandingServices } from "@/lib/requested-services";

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
