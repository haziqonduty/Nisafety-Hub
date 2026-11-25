import { AdminCompaniesTable } from "@/app/_components/admin-companies-table";
import { BackupButton } from "@/app/_components/backup-button";
import { Download } from "@/app/_components/icons";
import { groupCompanies } from "@/lib/admin-companies";
import { todayInMalaysia } from "@/lib/format";
import { getAdminClients } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const clients = await getAdminClients();
  const companies = groupCompanies(clients, todayInMalaysia());
  const attention = companies.filter((company) => company.status === "expired" || company.status === "expiring").length;
  const stats = [
    { label: "COMPANIES", value: companies.length, hint: `${clients.length} client ${clients.length === 1 ? "record" : "records"}` },
    { label: "REPORTS", value: companies.reduce((sum, company) => sum + company.reports.length, 0), hint: "across all services" },
    { label: "NEEDS ATTENTION", value: attention, hint: "expired or expiring soon", tone: attention > 0 ? "text-danger" : "" },
  ];

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">CLIENT RECORDS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Companies</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">Every company once, with its services and status. Open one to manage its contacts and reports.</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <BackupButton />
        {/* File download, not a page navigation — next/link's prefetching would trigger the export on every dashboard load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/admin/clients/export"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(16,42,51,.18)] transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
        >
          <Download className="h-4 w-4" /> Export to Excel
        </a>
        </div>
      </div>
      <dl className="mt-8 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-[0_10px_30px_rgba(16,42,51,.04)]">
            <dt className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{stat.label}</dt>
            <dd className={`mt-1.5 text-3xl font-semibold tabular-nums tracking-[-0.04em] ${stat.tone ?? ""}`}>{stat.value}</dd>
            <dd className="text-xs text-ink-muted">{stat.hint}</dd>
          </div>
        ))}
      </dl>
      <AdminCompaniesTable companies={companies} />
    </section>
  );
}
