import { AdminAnalyticsCharts } from "@/app/_components/admin-analytics-charts";
import { AdminMonthDetail } from "@/app/_components/admin-month-detail";
import { AdminMonthlyTrends } from "@/app/_components/admin-monthly-trends";
import { computeAnalytics } from "@/lib/analytics";
import { getAdminAnalyticsData } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

function KpiTile({ label, value, compact }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-mono text-xs font-semibold tracking-[0.12em] text-ink-faint">{label.toUpperCase()}</p>
      <p className={`mt-2 truncate font-semibold tracking-[-0.03em] text-ink ${compact ? "text-lg" : "text-3xl"}`}>{value}</p>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const { documents, clientCreatedAt } = await getAdminAnalyticsData();
  const data = computeAnalytics(documents, clientCreatedAt);

  return (
    <section>
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">INSIGHTS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Directory analytics.</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">A live snapshot of submission activity across the directory.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label="Total clients" value={data.totalClients} />
        <KpiTile label="Total documents" value={data.totalDocuments} />
        <KpiTile label="Last 30 days" value={data.documentsLast30Days} />
        <KpiTile label="Top category" value={data.topCategory ?? "—"} compact />
      </div>

      <AdminAnalyticsCharts data={data} />
      <AdminMonthlyTrends data={data} />
      <AdminMonthDetail data={data} />
    </section>
  );
}
