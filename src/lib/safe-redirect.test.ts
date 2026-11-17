import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/ms/renewals?filter=expired")).toBe("/ms/renewals?filter=expired");
  });

  it("refuses outside websites and tricks that look like paths", () => {
    expect(safeNextPath("https://example.com/phish")).toBe("/reset-password");
    expect(safeNextPath("//example.com")).toBe("/reset-password");
    expect(safeNextPath("/\\example.com")).toBe("/reset-password");
    expect(safeNextPath("javascript:alert(1)")).toBe("/reset-password");
  });

  it("falls back when missing", () => {
    expect(safeNextPath(null)).toBe("/reset-password");
    expect(safeNextPath("")).toBe("/reset-password");
  });
});
