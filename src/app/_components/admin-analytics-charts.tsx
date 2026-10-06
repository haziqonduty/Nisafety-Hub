"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsData } from "@/lib/analytics";
import type { CategoryTone } from "@/lib/format";

const TONE_COLOR: Record<CategoryTone, string> = {
  teal: "var(--color-accent)",
  amber: "var(--color-amber)",
  navy: "var(--color-badge-neutral-text)",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="mb-4 font-mono text-xs font-semibold tracking-[0.12em] text-ink-faint">{title.toUpperCase()}</p>
      {children}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-line)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontSize: 13,
};

export function AdminAnalyticsCharts({ data }: { data: AnalyticsData }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <ChartCard title="Submissions over time">
        <ResponsiveContainer width="100%" height={260}>
          <RBarChart data={data.monthlySubmissions}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-surface-soft)" }} />
            <Bar dataKey="count" name="Documents" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
          </RBarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Documents by category group">
        <div className="flex items-center gap-6">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.categoryGroups} dataKey="count" nameKey="group" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {data.categoryGroups.map((entry) => (
                  <Cell key={entry.group} fill={TONE_COLOR[entry.tone]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-1.5">
          {data.categoryGroups.map((entry) => (
            <li key={entry.group} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE_COLOR[entry.tone] }} />
                {entry.group}
              </span>
              <span className="font-semibold text-ink">{entry.count}</span>
            </li>
          ))}
        </ul>
      </ChartCard>

      <ChartCard title="Top categories">
        <ResponsiveContainer width="100%" height={280}>
          <RBarChart data={data.topCategories} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid stroke="var(--color-line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="category"
              width={160}
              tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: string) => (value.length > 24 ? `${value.slice(0, 24)}…` : value)}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-surface-soft)" }} />
            <Bar dataKey="count" name="Documents" radius={[0, 6, 6, 0]}>
              {data.topCategories.map((entry) => (
                <Cell key={entry.category} fill={TONE_COLOR[entry.tone]} />
              ))}
            </Bar>
          </RBarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top companies">
        <ResponsiveContainer width="100%" height={280}>
          <RBarChart data={data.topCompanies} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid stroke="var(--color-line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="company"
              width={160}
              tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: string) => (value.length > 22 ? `${value.slice(0, 22)}…` : value)}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-surface-soft)" }} />
            <Bar dataKey="count" name="Documents" fill="var(--color-brand)" radius={[0, 6, 6, 0]} />
          </RBarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
