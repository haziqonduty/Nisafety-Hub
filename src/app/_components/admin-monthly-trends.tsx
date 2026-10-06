"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsData } from "@/lib/analytics";
import { CATEGORY_GROUPS } from "@/lib/format";

// Validated against both the light (#fcfcfb) and dark (#101f24) chart
// surfaces with scripts/validate_palette.js from the dataviz skill — this
// exact pair clears the lightness band, chroma floor, and CVD/normal-vision
// separation checks in both modes, so no separate dark-mode variants needed.
const GROUP_COLOR: Record<string, string> = {
  [CATEGORY_GROUPS[0].group]: "#0D9488",
  [CATEGORY_GROUPS[1].group]: "#B86A00",
};
const DOCUMENTS_HUE = "#0D9488";
const CLIENTS_HUE = "#475569";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-line)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontSize: 13,
};

function TrendCard({ title, hue, data }: { title: string; hue: string; data: { month: string; count: number }[] }) {
  const renderEndDot = (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy, index } = props;
    if (cx === undefined || cy === undefined || index !== data.length - 1) return <g key={index} />;
    return <circle key={index} cx={cx} cy={cy} r={4.5} fill={hue} stroke="var(--color-surface)" strokeWidth={2} />;
  };

  const latest = data[data.length - 1]?.count ?? 0;
  const previous = data[data.length - 2]?.count ?? 0;
  const delta = latest - previous;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between">
        <p className="font-mono text-xs font-semibold tracking-[0.12em] text-ink-faint">{title.toUpperCase()}</p>
        {data.length > 1 && (
          <span className={`font-mono text-[10px] font-semibold ${delta === 0 ? "text-ink-faint" : "text-ink-muted"}`}>
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "–"} {Math.abs(delta)} vs last month
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink">{latest}</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} interval={1} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--color-line)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="count"
            name={title}
            stroke={hue}
            strokeWidth={2}
            fill={hue}
            fillOpacity={0.1}
            dot={renderEndDot}
            activeDot={{ r: 5, fill: hue, stroke: "var(--color-surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminMonthlyTrends({ data }: { data: AnalyticsData }) {
  return (
    <div className="mt-10">
      <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">12-MONTH PERFORMANCE</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Monthly trend, at a glance.</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-muted">Reports, categories, and new clients tracked month over month for the past year.</p>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendCard title="Documents per month" hue={DOCUMENTS_HUE} data={data.monthlySubmissions} />
        <TrendCard title="New clients per month" hue={CLIENTS_HUE} data={data.monthlyClients} />
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-xs font-semibold tracking-[0.12em] text-ink-faint">CATEGORY GROUP TREND</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.monthlyCategoryGroups} margin={{ top: 12, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-surface-soft)" }} />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "var(--color-ink-muted)" }}
            />
            {CATEGORY_GROUPS.map((group) => (
              <Bar
                key={group.group}
                dataKey={group.group}
                name={group.group}
                stackId="groups"
                fill={GROUP_COLOR[group.group]}
                stroke="var(--color-surface)"
                strokeWidth={2}
                radius={group === CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1] ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface p-5">
        <p className="mb-4 font-mono text-xs font-semibold tracking-[0.12em] text-ink-faint">MONTHLY BREAKDOWN</p>
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th className="pb-2 font-mono text-[10px] font-semibold tracking-[0.1em]">MONTH</th>
              <th className="pb-2 text-right font-mono text-[10px] font-semibold tracking-[0.1em]">DOCUMENTS</th>
              <th className="pb-2 text-right font-mono text-[10px] font-semibold tracking-[0.1em]">NEW CLIENTS</th>
              <th className="pb-2 text-right font-mono text-[10px] font-semibold tracking-[0.1em]">CATEGORIES COVERED</th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyTable.map((row, index) => {
              const previous = data.monthlyTable[index - 1];
              const delta = previous ? row.documents - previous.documents : null;
              return (
                <tr key={row.month} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 font-medium text-ink">{row.month}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-ink">
                    {row.documents}
                    {delta !== null && delta !== 0 && (
                      <span className="ml-1.5 text-xs text-ink-faint">{delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-ink-muted">{row.clients}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-ink-muted">{row.categories}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
