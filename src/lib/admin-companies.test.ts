import { describe, expect, it } from "vitest";
import { companyKey, groupCompanies } from "@/lib/admin-companies";
import type { AdminClient } from "@/lib/supabase/queries";

const CHRA = "Chemical Health Risk Assessment (CHRA)";
const NRA = "Noise Risk Assessment (NRA)";
const TODAY = "2026-11-25";

function client(overrides: Partial<AdminClient> & { id: string; companyName: string }): AdminClient {
  return {
    clientName: "MS TESTER",
    telephone: "0123456789",
    email: "a@example.com",
    submitterName: "Staff",
    additionalClientNames: [],
    additionalTelephones: [],
    additionalEmails: [],
    internalNotes: null,
    requestedServices: [],
    date: "",
    createdAt: "2026-11-01T00:00:00Z",
    documents: [],
    ...overrides,
  };
}

function report(id: string, category: string, serviceDate: string, expiryDate: string | null, extra: { renewalClosed?: boolean; createdAt?: string } = {}) {
  return { id, category, fileName: `${id}.pdf`, serviceDate, expiryDate, renewalClosed: extra.renewalClosed ?? false, salesPerson: null, maincon: null, createdAt: extra.createdAt ?? `${serviceDate}T00:00:00Z` };
}

describe("companyKey", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(companyKey("ACME SDN BHD")).toBe("acme-sdn-bhd");
    expect(companyKey("Acme Sdn. Bhd.")).toBe("acme-sdn-bhd");
    expect(companyKey("BETA TEC (M) SDN BHD")).toBe("beta-tec-m-sdn-bhd");
    expect(companyKey("  ")).toBe("unnamed");
  });
});

describe("groupCompanies", () => {
  it("merges records of the same company and collects every report", () => {
    const companies = groupCompanies(
      [
        client({ id: "a", companyName: "ACME SDN BHD", documents: [report("r1", NRA, "2026-09-24", "2031-09-24")] }),
        client({ id: "b", companyName: "Acme Sdn. Bhd.", createdAt: "2026-11-02T00:00:00Z", documents: [report("r2", CHRA, "2026-09-03", "2031-09-03")] }),
        client({ id: "c", companyName: "OTHER SDN BHD" }),
      ],
      TODAY,
    );
    expect(companies).toHaveLength(2);
    const acme = companies.find((company) => company.key === "acme-sdn-bhd")!;
    expect(acme.clients.map((record) => record.id)).toEqual(["b", "a"]);
    expect(acme.name).toBe("Acme Sdn. Bhd.");
    expect(acme.reports.map((entry) => entry.id)).toEqual(["r1", "r2"]);
    expect(acme.services).toEqual([NRA, CHRA]);
    expect(acme.status).toBe("valid");
    expect(acme.nextExpiry).toBe("2031-09-03");
    expect(companies.find((company) => company.key === "other-sdn-bhd")!.status).toBe("no_report");
  });

  it("takes the most urgent latest report, ignoring renewed and closed ones", () => {
    const [company] = groupCompanies(
      [
        client({
          id: "a",
          companyName: "X",
          documents: [
            report("old", CHRA, "2019-01-01", "2024-01-01"), // renewed by "new"
            report("new", CHRA, "2026-01-01", "2031-01-01"),
            report("noise", NRA, "2020-01-01", "2025-01-01", { renewalClosed: true }), // action taken
          ],
        }),
      ],
      TODAY,
    );
    expect(company.reports.find((entry) => entry.id === "old")!.status).toBe("renewed");
    expect(company.reports.find((entry) => entry.id === "noise")!.status).toBe("closed");
    expect(company.status).toBe("valid");

    const [expired] = groupCompanies([client({ id: "b", companyName: "Y", documents: [report("e", CHRA, "2020-01-01", "2025-01-01")] })], TODAY);
    expect(expired.status).toBe("expired");
  });

  it("lists requested services that still have no report", () => {
    const [company] = groupCompanies(
      [client({ id: "a", companyName: "X", requestedServices: [CHRA, NRA], documents: [report("r", CHRA, "2026-01-01", "2031-01-01")] })],
      TODAY,
    );
    expect(company.outstanding).toEqual([NRA]);
  });

  it("orders companies by latest activity", () => {
    const companies = groupCompanies(
      [
        client({ id: "a", companyName: "Older", createdAt: "2026-01-01T00:00:00Z" }),
        client({ id: "b", companyName: "Newer", createdAt: "2026-02-01T00:00:00Z" }),
        client({ id: "c", companyName: "Busy", createdAt: "2025-01-01T00:00:00Z", documents: [report("r", CHRA, "2026-03-01", null, { createdAt: "2026-03-01T00:00:00Z" })] }),
      ],
      TODAY,
    );
    expect(companies.map((company) => company.name)).toEqual(["Busy", "Newer", "Older"]);
  });
});
