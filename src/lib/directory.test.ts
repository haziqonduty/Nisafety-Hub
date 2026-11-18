import { describe, expect, it } from "vitest";
import { pageNumbers, parseDirectoryPageSize, parseDirectorySort, parseDirectoryStatus } from "@/lib/directory";

describe("parseDirectorySort", () => {
  it("accepts the known sorts", () => {
    expect(parseDirectorySort("name")).toBe("name");
    expect(parseDirectorySort("expiry")).toBe("expiry");
    expect(parseDirectorySort("newest")).toBe("newest");
  });

  it("falls back to recent activity for anything else", () => {
    expect(parseDirectorySort(null)).toBe("recent");
    expect(parseDirectorySort("")).toBe("recent");
    expect(parseDirectorySort("name; drop table clients")).toBe("recent");
  });
});

describe("parseDirectoryStatus", () => {
  it("accepts the filterable statuses", () => {
    expect(parseDirectoryStatus("expired")).toBe("expired");
    expect(parseDirectoryStatus("no_report")).toBe("no_report");
  });

  it("ignores unknown values, including the internal 'none' status", () => {
    expect(parseDirectoryStatus("none")).toBeNull();
    expect(parseDirectoryStatus("anything")).toBeNull();
    expect(parseDirectoryStatus(undefined)).toBeNull();
  });
});

describe("parseDirectoryPageSize", () => {
  it("accepts the offered sizes and falls back to 20", () => {
    expect(parseDirectoryPageSize("50")).toBe(50);
    expect(parseDirectoryPageSize(100)).toBe(100);
    expect(parseDirectoryPageSize("7")).toBe(20);
    expect(parseDirectoryPageSize(null)).toBe(20);
  });
});

describe("pageNumbers", () => {
  it("lists every page when there are few", () => {
    expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses long ranges around the current page", () => {
    expect(pageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageNumbers(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageNumbers(12, 12)).toEqual([1, null, 11, 12]);
  });
});
