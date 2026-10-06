import { AdminClientsTable } from "@/app/_components/admin-clients-table";
import { Download } from "@/app/_components/icons";
import { getAdminClients } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const clients = await getAdminClients();

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">CLIENT RECORDS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Manage submitted clients.</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">Edit client name, telephone, and email. Changes apply immediately to the public record.</p>
        </div>
        {/* File download, not a page navigation — next/link's prefetching would trigger the export on every dashboard load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/admin/clients/export"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(16,42,51,.18)] transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
        >
          <Download className="h-4 w-4" /> Export to Excel
        </a>
      </div>
      <AdminClientsTable clients={clients} />
    </section>
  );
}
