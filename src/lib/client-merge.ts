import { cleanRequestedServices } from "@/lib/requested-services";

/**
 * Extra contact names / phones / emails a company can hold besides its main
 * one. KEEP IN SYNC with the additional_*_limit checks in
 * supabase/migrations/20261125_one_record_per_company.sql.
 */
export const MAX_ADDITIONAL_CONTACTS = 10;

/** The dummy address staff enter when a client has no email; never kept as an extra contact. */
export const PLACEHOLDER_EMAIL = "no-email@example.com";

/**
 * "Same company" = same letters and digits, ignoring case, spaces and
 * punctuation. KEEP IN SYNC with public.company_match_key() in SQL.
 */
export function companyMatchKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type CompanyContacts = {
  clientName: string;
  telephone: string;
  email: string;
  additionalClientNames: string[];
  additionalTelephones: string[];
  additionalEmails: string[];
  requestedServices: string[];
};

const nameKey = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();
const phoneKey = (value: string) => value.replace(/\D/g, "");
const emailKey = (value: string) => value.trim().toLowerCase();

function addNew(list: string[], main: string, incoming: string[], key: (value: string) => string, skip: (value: string) => boolean = () => false) {
  const seen = new Set([key(main), ...list.map(key)]);
  const result = [...list];
  for (const raw of incoming) {
    const value = raw.trim();
    const k = key(value);
    if (!k || skip(value) || seen.has(k)) continue;
    seen.add(k);
    result.push(value);
  }
  return result.slice(0, MAX_ADDITIONAL_CONTACTS);
}

/**
 * A new report (or "client details only") arrived for a company that already
 * has a record: keep the record's main contact, add any NEW names / phones /
 * emails as extra contacts (no repeats, no placeholder email), and add any
 * newly requested services.
 */
export function mergeIntoCompany(
  existing: CompanyContacts,
  incoming: { clientNames: string[]; telephones: string[]; emails: string[]; requestedServices: string[] },
) {
  return {
    additionalClientNames: addNew(existing.additionalClientNames, existing.clientName, incoming.clientNames, nameKey),
    additionalTelephones: addNew(existing.additionalTelephones, existing.telephone, incoming.telephones, phoneKey),
    additionalEmails: addNew(existing.additionalEmails, existing.email, incoming.emails, emailKey, (value) => emailKey(value) === PLACEHOLDER_EMAIL),
    requestedServices: cleanRequestedServices([...existing.requestedServices, ...incoming.requestedServices]),
  };
}
