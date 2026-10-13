function KpiTileSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-surface p-5">
      <div className="h-3 w-24 rounded bg-surface-soft" />
      <div className="mt-3 h-8 w-16 rounded bg-surface-soft" />
    </div>
  );
}

function ChartBlockSkeleton({ height = "h-72" }: { height?: string }) {
  return <div className={`mt-6 animate-pulse rounded-2xl border border-line bg-surface ${height}`} />;
}

export default function AdminAnalyticsLoading() {
  return (
    <section>
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-20 rounded bg-surface-soft" />
        <div className="h-8 w-80 rounded bg-surface-soft" />
        <div className="h-4 w-96 rounded bg-surface-soft" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <KpiTileSkeleton key={index} />
        ))}
      </div>

      <ChartBlockSkeleton />
      <ChartBlockSkeleton height="h-96" />
      <ChartBlockSkeleton height="h-80" />
    </section>
  );
}
