import Link from "next/link";
import { CompanyMonogram, CompanyStatusBadge, ServiceCode } from "@/app/_components/admin-company-ui";
import { ContactCard, ReportActions } from "@/app/_components/admin-company-detail";
import { ExpiryBadge } from "@/app/_components/expiry-badge";
import { Arrow, Calendar, File, Hourglass } from "@/app/_components/icons";
import type { AdminCompany, AdminCompanyReport } from "@/lib/admin-companies";
import { categoryNameWithoutAbbreviation, formatServiceDate, shortCategoryLabel, toneDotClass, toneForCategory } from "@/lib/format";

/** Plain-English badge text (the admin area is English-only). */
function badgeText(report: AdminCompanyReport) {
  const days = Math.abs(report.daysLeft ?? 0);
  switch (report.status) {
    case "expired":
      return `Expired ${days} ${days === 1 ? "day" : "days"} ago`;
    case "expiring":
    case "upcoming":
      return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
    case "valid":
      return `Valid · ${Math.max(1, Math.floor(days / 30.4))} mo left`;
    case "renewed":
      return "Renewed";
    case "closed":
      return "Action taken";
    default:
      return "No fixed expiry";
  }
}

/** The admin company page: hero, services & reports, contacts. Data comes from the page. */
export function AdminCompanyView({ company }: { company: AdminCompany }) {
  // Group the reports by service, newest first inside each (the first is the one that counts).
  const byService = new Map<string, AdminCompanyReport[]>();
  for (const report of company.reports) byService.set(report.category, [...(byService.get(report.category) ?? []), report]);
  const reportCounts = new Map<string, number>();
  for (const report of company.reports) reportCounts.set(report.clientId, (reportCounts.get(report.clientId) ?? 0) + 1);

  const stats = [
    { label: "CONTACTS", value: String(company.clients.length) },
    { label: "SERVICES", value: String(company.services.length) },
    { label: "REPORTS", value: String(company.reports.length) },
    { label: company.status === "expired" ? "EXPIRED ON" : "NEXT EXPIRY", value: company.nextExpiry ? formatServiceDate(company.nextExpiry) : "—" },
  ];
  // Only name the contact on each report when the company has more than one person.
  const manyContacts = new Set(company.clients.map((client) => client.clientName.trim())).size > 1;

  return (
    <section>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent">
        <Arrow className="h-4 w-4 rotate-180" /> All companies
      </Link>

      {/* Hero */}
      <div className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-line bg-surface p-6 shadow-[0_18px_44px_rgba(16,42,51,.06)] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <CompanyMonogram name={company.name} size="lg" />
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent">COMPANY</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{company.name}</h1>
            </div>
          </div>
          <CompanyStatusBadge status={company.status} />
        </div>
        <dl className="relative mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface px-4 py-3.5">
              <dt className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{stat.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums tracking-[-0.02em]">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Services & reports */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Services &amp; reports</h2>
            <span className="text-xs text-ink-muted">Latest report per service sets the status</span>
          </div>

          {company.outstanding.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-amber/40 bg-amber-soft/30 px-4 py-3 text-xs">
              <span className="font-semibold text-amber">To do · no report yet</span>
              {company.outstanding.map((category) => (
                <ServiceCode key={category} category={category} muted />
              ))}
              {(() => {
                const pending = company.clients.find((client) => client.pendingSalesPerson || client.pendingMaincon);
                if (!pending) return null;
                return (
                  <span className="ml-auto text-ink-muted">
                    Sales: {pending.pendingSalesPerson ?? "—"}
                    {pending.pendingMaincon ? ` · Maincon: ${pending.pendingMaincon}` : ""}
                  </span>
                );
              })()}
            </div>
          )}

          {company.reports.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">No reports attached to this company yet.</div>
          ) : (
            <div className="mt-4 space-y-4">
              {[...byService].map(([category, reports]) => {
                const short = shortCategoryLabel(category);
                return (
                  <section key={category} className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <header className="flex items-center gap-2.5 border-b border-line bg-surface-soft/60 px-5 py-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${toneDotClass(toneForCategory(category))}`} />
                      <h3 className="min-w-0 truncate text-sm font-semibold" title={category}>
                        {short}
                        {short !== category && <span className="ml-1.5 font-normal text-ink-muted">{categoryNameWithoutAbbreviation(category)}</span>}
                      </h3>
                      <span className="ml-auto shrink-0 text-xs text-ink-muted">
                        {reports.length} {reports.length === 1 ? "report" : "reports"}
                      </span>
                    </header>
                    <ul className="divide-y divide-line">
                      {reports.map((report) => (
                        <li key={report.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5">
                          <div className="min-w-0">
                            <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                              <File className="h-4 w-4 shrink-0 text-ink-faint" />
                              <span className="truncate">{report.fileName}</span>
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Calendar className="h-3 w-3" /> Monitored {formatServiceDate(report.serviceDate)}
                              </span>
                              {report.expiryDate && report.status !== "renewed" && report.status !== "closed" && (
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Hourglass className="h-3 w-3" /> Expires {formatServiceDate(report.expiryDate)}
                                </span>
                              )}
                              {manyContacts && <span>{report.clientName}</span>}
                              <span>Sales: {report.salesPerson ?? "—"}</span>
                              {report.maincon && <span>Maincon: {report.maincon}</span>}
                              <ExpiryBadge status={report.status} label={badgeText(report)} />
                            </p>
                          </div>
                          <ReportActions reportId={report.id} fileName={report.fileName} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Contacts */}
        <aside className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Contacts</h2>
          {company.clients.length > 1 && (
            <p className="mt-1 text-xs text-ink-muted">This company was saved as {company.clients.length} separate records; each is listed here.</p>
          )}
          <div className="mt-4 space-y-3">
            {company.clients.map((client) => (
              <ContactCard key={client.id} client={client} reportCount={reportCounts.get(client.id) ?? 0} isOnlyContact={company.clients.length === 1} />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
