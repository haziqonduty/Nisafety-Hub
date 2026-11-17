import { describe, expect, it } from "vitest";
import { distinctiveWords, isRelevantPlace, looksLikeLocationInput, searchableCompanyName } from "@/lib/place-match";

describe("searchableCompanyName", () => {
  it("drops company suffixes that confuse map search", () => {
    expect(searchableCompanyName("SPRING ART  INDUSTRIES SDN. BHD.")).toBe("Spring Art Industries");
    expect(searchableCompanyName("LRG RUBBER SDN BHD")).toBe("Lrg Rubber");
    expect(searchableCompanyName("SD GUTHRIE BERHAD LADANG LANADRON")).toBe("Sd Guthrie Ladang Lanadron");
    expect(searchableCompanyName("Tong Yong Rubber (M) Sdn Bhd")).toBe("Tong Yong Rubber");
  });
});

describe("isRelevantPlace — no more look-alike companies", () => {
  it("rejects the wrong companies the free search returned for real clients", () => {
    expect(isRelevantPlace("LRG Rubber", "NT Rubber-Seals Sdn Bhd", "Jitra")).toBe(false);
    expect(isRelevantPlace("Spring Art Industries", "Abiba Plastic Industries", "Sungai Petani")).toBe(false);
    expect(isRelevantPlace("SD Guthrie Ladang Lanadron", "SD Guthrie Ladang Sungai Buloh", "Kuala Selangor")).toBe(false);
  });
  it("accepts real matches, including while still typing", () => {
    expect(isRelevantPlace("Ladang Lanadron", "Klinik Ladang Lanadron", "Panchor, Johor")).toBe(true);
    expect(isRelevantPlace("Muar", "Muar", "Johor")).toBe(true);
    expect(isRelevantPlace("Ladang Lanadr", "SJK Tamil Ladang Lanadron", "Panchor")).toBe(true);
    expect(isRelevantPlace("Tong Yong Rubber Sdn Bhd", "Tong Yong Rubber (M) Sdn Bhd", "Shah Alam")).toBe(true);
  });
  it("trusts nothing when only generic words were typed", () => {
    expect(distinctiveWords("Sdn Bhd Industries")).toEqual([]);
    expect(isRelevantPlace("Sdn Bhd", "Anything Sdn Bhd")).toBe(false);
  });
});

describe("looksLikeLocationInput", () => {
  it("spots links and coordinates, not names", () => {
    expect(looksLikeLocationInput("https://maps.app.goo.gl/abc")).toBe(true);
    expect(looksLikeLocationInput("Loon Sing\n51, Jalan Indah\nhttps://maps.app.goo.gl/abc")).toBe(true);
    expect(looksLikeLocationInput("2.0425, 102.5659")).toBe(true);
    expect(looksLikeLocationInput("LRG Rubber")).toBe(false);
    expect(looksLikeLocationInput("Jalan 2/3 Shah Alam")).toBe(false);
  });
});
