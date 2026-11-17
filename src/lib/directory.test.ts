import { describe, expect, it } from "vitest";
import { parseDirectorySort, parseDirectoryStatus } from "@/lib/directory";

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
