import { describe, expect, it } from "vitest";
import { coordinatesFromGoogleUrl, isGoogleMapsUrl, isShortMapsLink, parseCoordinates, unwrapConsent } from "@/lib/coordinates";

describe("parseCoordinates", () => {
  it("reads what Google Maps copies on right-click", () => {
    expect(parseCoordinates("2.0425, 102.5659")).toEqual({ latitude: 2.0425, longitude: 102.5659 });
    expect(parseCoordinates(" (3.139003,101.686855) ")).toEqual({ latitude: 3.139003, longitude: 101.686855 });
    expect(parseCoordinates("5.4164° N, 100.3327° E")).toEqual({ latitude: 5.4164, longitude: 100.3327 });
  });
  it("rejects text and impossible values", () => {
    expect(parseCoordinates("Muar, Johor")).toBeNull();
    expect(parseCoordinates("200, 101")).toBeNull();
    expect(parseCoordinates("")).toBeNull();
  });
});

describe("coordinatesFromGoogleUrl", () => {
  it("prefers the place pin over the camera centre", () => {
    const url = new URL(
      "https://www.google.com/maps/place/Ladang+Lanadron/@2.17,102.70,15z/data=!3m1!4b1!4m6!3m5!1s0x31d1:0x9!8m2!3d2.1718308!4d102.7157927!16s",
    );
    expect(coordinatesFromGoogleUrl(url)).toEqual({ latitude: 2.1718308, longitude: 102.7157927, label: "Ladang Lanadron" });
  });
  it("falls back to query coordinates, then the camera centre", () => {
    expect(coordinatesFromGoogleUrl(new URL("https://maps.google.com/?q=3.1390,101.6869"))).toEqual({ latitude: 3.139, longitude: 101.6869, label: null });
    expect(coordinatesFromGoogleUrl(new URL("https://www.google.com/maps/search/2.04,+102.56"))).toEqual({ latitude: 2.04, longitude: 102.56, label: null });
    expect(coordinatesFromGoogleUrl(new URL("https://www.google.com/maps/@5.41,100.33,14z"))).toEqual({ latitude: 5.41, longitude: 100.33, label: null });
  });
  it("returns null when the link has no location", () => {
    expect(coordinatesFromGoogleUrl(new URL("https://www.google.com/maps/place/Muar"))).toBeNull();
  });
});

describe("link checks", () => {
  it("only accepts Google Maps over https", () => {
    expect(isGoogleMapsUrl(new URL("https://maps.app.goo.gl/abc"))).toBe(true);
    expect(isGoogleMapsUrl(new URL("https://www.google.com.my/maps/place/x"))).toBe(true);
    expect(isGoogleMapsUrl(new URL("http://maps.app.goo.gl/abc"))).toBe(false);
    expect(isGoogleMapsUrl(new URL("https://evil.example/maps"))).toBe(false);
    expect(isGoogleMapsUrl(new URL("https://maps.app.goo.gl.evil.example/x"))).toBe(false);
  });
  it("spots short links and unwraps the consent page", () => {
    expect(isShortMapsLink(new URL("https://maps.app.goo.gl/abc"))).toBe(true);
    expect(isShortMapsLink(new URL("https://www.google.com/maps/place/x"))).toBe(false);
    const wrapped = new URL("https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FX%2F%403%2C101");
    expect(unwrapConsent(wrapped).hostname).toBe("www.google.com");
  });
});
