"use client";

import { useState } from "react";
import type { AnalyticsData } from "@/lib/analytics";
import { toneBadgeClass, toneDotClass } from "@/lib/format";

function MiniKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface-soft p-4">
      <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-ink-faint">{label.toUpperCase()}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
    </div>
  );
}

export function AdminMonthDetail({ data }: { data: AnalyticsData }) {
  const months = data.monthlyDetails;
  const [selectedIndex, setSelectedIndex] = useState(months.length - 1);
  const month = months[selectedIndex];
  const maxCategoryCount = Math.max(1, ...month.categories.map((entry) => entry.count));

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">MONTH BY MONTH</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Pick a month to track in detail.</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">Every report, category, and client recorded in a single month.</p>
        </div>
        <label className="text-sm font-semibold">
          <span className="sr-only">Select month</span>
          <select
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
          >
            {months.map((entry, index) => (
              <option key={entry.monthKey} value={index}>
                {entry.month}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniKpi label="Documents" value={month.documents} />
          <MiniKpi label="New clients" value={month.clients} />
          <MiniKpi label="Categories covered" value={month.categories.length} />
        </div>

        {month.documents === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            No submissions recorded in {month.month}.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-ink-faint">CATEGORIES THIS MONTH</p>
              <ul className="mt-3 space-y-2.5">
                {month.categories.map((entry) => (
                  <li key={entry.category}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${toneDotClass(entry.tone)}`} />
                        <span className="truncate font-medium text-ink">{entry.category}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${toneBadgeClass(entry.tone)}`}>{entry.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
                      <div className={`h-full rounded-full ${toneDotClass(entry.tone)}`} style={{ width: `${(entry.count / maxCategoryCount) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-ink-faint">COMPANIES THIS MONTH</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {month.companies.map((entry) => (
                  <span key={entry.company} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink">
                    {entry.company}
                    <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">{entry.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
