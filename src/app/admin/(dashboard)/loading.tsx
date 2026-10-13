function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-full bg-surface-soft" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-48 rounded bg-surface-soft" />
          <div className="h-3 w-72 rounded bg-surface-soft" />
          <div className="h-3 w-40 rounded bg-surface-soft" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardLoading() {
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-28 rounded bg-surface-soft" />
          <div className="h-8 w-72 rounded bg-surface-soft" />
          <div className="h-4 w-96 rounded bg-surface-soft" />
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </section>
  );
}
