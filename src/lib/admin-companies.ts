import { companyMatchKey } from "@/lib/client-merge";
import type { AdminClient } from "@/lib/supabase/queries";
import { expiryStatus, type ExpiryStatus } from "@/lib/validity";

/** A company's overall state: the most urgent of its tracked services, or "no_report". */
export type CompanyStatus = "expired" | "expiring" | "upcoming" | "valid" | "none" | "no_report";

export type AdminCompanyReport = AdminClient["documents"][number] & {
  clientId: string;
  clientName: string;
  status: ExpiryStatus;
  daysLeft: number | null;
};

export type AdminCompany = {
  /** URL-safe id for /admin/companies/[key], e.g. "acme-sdn-bhd". */
  key: string;
  /** Name as written on the most recent record. */
  name: string;
  /** The client records (contacts) filed under this company, newest first. */
  clients: AdminClient[];
  /** Every report across those records, newest monitoring date first. */
  reports: AdminCompanyReport[];
  /** Distinct services with a report, in the order first seen (newest first). */
  services: string[];
  /** Services a record asked for that have no report yet. */
  outstanding: string[];
  status: CompanyStatus;
  /** Soonest expiry among the tracked (latest, not closed) reports. */
  nextExpiry: string | null;
  lastActivity: string;
};

/**
 * "ACME SDN. BHD." and "Acme Sdn Bhd" are the same company: compare
 * letters and digits only. Also the URL key.
 */
export function companyKey(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unnamed"
  );
}

const URGENCY: Record<CompanyStatus, number> = { expired: 0, expiring: 1, upcoming: 2, valid: 3, none: 4, no_report: 5 };

export function moreUrgentCompanyStatus(a: CompanyStatus, b: CompanyStatus): CompanyStatus {
  return URGENCY[a] <= URGENCY[b] ? a : b;
}

/** Groups client records into companies (admin list), most recently active first. */
export function groupCompanies(clients: AdminClient[], today: string): AdminCompany[] {
  // Same "same company" rule as the database (company_match_key).
  const groups = new Map<string, AdminClient[]>();
  for (const client of clients) {
    const match = companyMatchKey(client.companyName);
    groups.set(match, [...(groups.get(match) ?? []), client]);
  }

  const companies: AdminCompany[] = [];
  for (const records of groups.values()) {
    const sortedRecords = [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const key = companyKey(sortedRecords[0].companyName);
    const all = sortedRecords
      .flatMap((client) => client.documents.map((document) => ({ ...document, clientId: client.id, clientName: client.clientName })))
      .sort((a, b) => (a.serviceDate !== b.serviceDate ? (a.serviceDate < b.serviceDate ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));

    // Same rule as the renewals tracker: only the latest report per service counts.
    const latest = new Set<string>();
    const reports: AdminCompanyReport[] = all.map((report) => {
      const superseded = latest.has(report.category);
      latest.add(report.category);
      const { status, daysLeft } = expiryStatus(report.expiryDate, today, superseded, report.renewalClosed);
      return { ...report, status, daysLeft };
    });

    let status: CompanyStatus = reports.length === 0 ? "no_report" : "none";
    let nextExpiry: string | null = null;
    for (const report of reports) {
      if (report.status === "renewed" || report.status === "closed" || report.status === "none") continue;
      status = moreUrgentCompanyStatus(status, report.status);
      if (report.expiryDate && (!nextExpiry || report.expiryDate < nextExpiry)) nextExpiry = report.expiryDate;
    }

    const services = [...latest];
    const requested = new Set(sortedRecords.flatMap((client) => client.requestedServices));
    const outstanding = [...requested].filter((service) => !latest.has(service));
    const activity = [...sortedRecords.map((client) => client.createdAt), ...reports.map((report) => report.createdAt)].sort();

    companies.push({
      key,
      name: sortedRecords[0].companyName,
      clients: sortedRecords,
      reports,
      services,
      outstanding,
      status,
      nextExpiry,
      lastActivity: activity[activity.length - 1],
    });
  }

  return companies.sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1));
}
