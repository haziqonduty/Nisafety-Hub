import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { companyMatchKey, MAX_ADDITIONAL_CONTACTS, mergeIntoCompany, type CompanyContacts } from "@/lib/client-merge";

const CHRA = "Chemical Health Risk Assessment (CHRA)";
const NRA = "Noise Risk Assessment (NRA)";

const existing: CompanyContacts = {
  clientName: "MS TESTER",
  telephone: "012-000 0001",
  email: "tester@example.com",
  additionalClientNames: [],
  additionalTelephones: [],
  additionalEmails: [],
  requestedServices: [NRA],
};

describe("companyMatchKey", () => {
  it("treats case, spaces and punctuation as the same company", () => {
    expect(companyMatchKey("ACME SDN BHD")).toBe(companyMatchKey("Acme Sdn. Bhd."));
    expect(companyMatchKey("BETA TEC (M) SDN BHD")).toBe("betatecmsdnbhd");
    expect(companyMatchKey("G.B WORKS")).not.toBe(companyMatchKey("G.C WORKS"));
  });
});

describe("mergeIntoCompany", () => {
  it("adds nothing when the same person sends another report", () => {
    const merged = mergeIntoCompany(existing, { clientNames: ["ms tester "], telephones: ["0120000001"], emails: ["TESTER@example.com"], requestedServices: [] });
    expect(merged.additionalClientNames).toEqual([]);
    expect(merged.additionalTelephones).toEqual([]);
    expect(merged.additionalEmails).toEqual([]);
  });

  it("keeps a different person as an extra contact", () => {
    const merged = mergeIntoCompany(existing, { clientNames: ["MR LIM"], telephones: ["012-345 6789"], emails: ["lim@example.com"], requestedServices: [CHRA] });
    expect(merged.additionalClientNames).toEqual(["MR LIM"]);
    expect(merged.additionalTelephones).toEqual(["012-345 6789"]);
    expect(merged.additionalEmails).toEqual(["lim@example.com"]);
    expect(merged.requestedServices).toEqual([CHRA, NRA]);
  });

  it("never keeps the placeholder email or repeats", () => {
    const merged = mergeIntoCompany(
      { ...existing, additionalClientNames: ["MR LIM"] },
      { clientNames: ["MR LIM", "MR LIM"], telephones: [], emails: ["no-email@example.com"], requestedServices: [] },
    );
    expect(merged.additionalClientNames).toEqual(["MR LIM"]);
    expect(merged.additionalEmails).toEqual([]);
  });

  it("gives a company with no email the first real address as its main email", () => {
    const merged = mergeIntoCompany({ ...existing, email: "" }, { clientNames: [], telephones: [], emails: ["no-email@example.com", "first@example.com", "second@example.com"], requestedServices: [] });
    expect(merged.email).toBe("first@example.com");
    expect(merged.additionalEmails).toEqual(["second@example.com"]);
    expect(mergeIntoCompany({ ...existing, email: "" }, { clientNames: [], telephones: [], emails: [], requestedServices: [] }).email).toBe("");
    expect(mergeIntoCompany(existing, { clientNames: [], telephones: [], emails: ["other@example.com"], requestedServices: [] }).email).toBe("tester@example.com");
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: 15 }, (_, index) => `PERSON ${index}`);
    expect(mergeIntoCompany(existing, { clientNames: many, telephones: [], emails: [], requestedServices: [] }).additionalClientNames).toHaveLength(MAX_ADDITIONAL_CONTACTS);
  });

  it("matches the database limits and key (KEEP IN SYNC)", () => {
    const sql = readFileSync("supabase/migrations/20261125_one_record_per_company.sql", "utf8");
    for (const column of ["additional_client_names", "additional_telephones", "additional_emails"]) {
      expect(sql).toContain(`check (cardinality(${column}) <= ${MAX_ADDITIONAL_CONTACTS})`);
    }
    expect(sql).toContain("regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g')");
  });
});
