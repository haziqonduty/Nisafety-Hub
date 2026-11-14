"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ExpiryBadge, expiryLabel } from "@/app/_components/expiry-badge";
import { Arrow, RefreshCw, Search } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import { categoryNameWithoutAbbreviation, formatServiceDate, shortCategoryLabel, todayInMalaysia, toneDotClass, toneForCategory } from "@/lib/format";
import type { RenewalItem } from "@/lib/supabase/queries";
import { EXPIRY_STATUS_STYLES, validityProgress } from "@/lib/validity";

export type TrackerFilter = "all" | "expired" | "expiring" | "upcoming" | "valid";

const FILTERS: TrackerFilter[] = ["all", "expired", "expiring", "upcoming", "valid"];

const ACCENT_BAR: Record<RenewalItem["status"], string> = {
  expired: "before:bg-danger",
  expiring: "before:bg-amber",
  upcoming: "before:bg-amber/50",
  valid: "before:bg-accent",
};

export function RenewalsTracker({ items, initialFilter }: { items: RenewalItem[]; initialFilter: TrackerFilter }) {
  const t = useTranslations("expiry");
  const tCategories = useTranslations("categories.items");
  const locale = useLocale();
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const today = todayInMalaysia();
  const [filter, setFilter] = useState<TrackerFilter>(initialFilter);
  const [query, setQuery] = useState("");

  function label(category: string) {
    try {
      return tCategories(category);
    } catch {
      return category;
    }
  }

  const counts = useMemo(() => {
    const result: Record<TrackerFilter, number> = { all: items.length, expired: 0, expiring: 0, upcoming: 0, valid: 0 };
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (filter === "all" || item.status === filter) &&
        (!q || `${item.company} ${item.clientName} ${item.category}`.toLowerCase().includes(q)),
    );
  }, [filter, items, query]);

  // Overdue first as its own group, then one group per expiry month.
  const groups = useMemo(() => {
    const result: { key: string; title: string; items: RenewalItem[] }[] = [];
    for (const item of visible) {
      const key = item.status === "expired" ? "overdue" : item.expiryDate.slice(0, 7);
      let group = result.find((entry) => entry.key === key);
      if (!group) {
        const title =
          key === "overdue"
            ? t("groupOverdue")
            : new Date(`${key}-01T00:00:00Z`).toLocaleDateString(intlLocale, { month: "long", year: "numeric", timeZone: "UTC" });
        group = { key, title, items: [] };
        result.push(group);
      }
      group.items.push(item);
    }
    return result;
  }, [intlLocale, t, visible]);

  const filterLabel: Record<TrackerFilter, string> = {
    all: t("filterAll"),
    expired: t("tileExpired"),
    expiring: t("tileExpiring"),
    upcoming: t("tileUpcoming"),
    valid: t("tileValid"),
  };

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[0_16px_40px_rgba(16,42,51,.05)] lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-soft p-1 [scrollbar-width:none]" role="tablist" aria-label={t("filterLabel")}>
          {FILTERS.map((key) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  active ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:text-ink"
                }`}
              >
                {key !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${EXPIRY_STATUS_STYLES[key].dot}`} />}
                {filterLabel[key]}
                <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${active ? "bg-white/15" : "bg-surface text-ink-faint"}`}>{counts[key]}</span>
              </button>
            );
          })}
        </div>
        <label className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-surface-soft px-4 py-2.5 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          <Search className="h-4 w-4 text-accent" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint" />
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-[1.5rem] border border-dashed border-line px-6 py-14 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
            <RefreshCw className="h-5 w-5" />
          </span>
          <p className="mt-4 font-semibold">{items.length === 0 ? t("trackerEmpty") : t("trackerNoMatch")}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{items.length === 0 ? t("trackerEmptyHint") : t("trackerNoMatchHint")}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.title}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className={`text-sm font-semibold tracking-[-0.01em] ${group.key === "overdue" ? "text-danger" : ""}`}>{group.title}</h2>
                <span className="text-xs text-ink-muted">{t("groupCount", { count: group.items.length })}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
                {group.items.map((item, index) => {
                  const full = label(item.category);
                  const short = shortCategoryLabel(full);
                  const badge = expiryLabel(item.status, item.daysLeft);
                  const progress = validityProgress(item.serviceDate, item.expiryDate, today);
                  return (
                    <li
                      key={item.id}
                      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                      className={`relative grid grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 pl-6 shadow-[0_10px_30px_rgba(16,42,51,.04)] transition-all animate-[rise_.45s_ease-out_both] before:absolute before:inset-y-0 before:left-0 before:w-1 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(16,42,51,.09)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-8 ${ACCENT_BAR[item.status]}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3 lg:block">
                          <p className="truncate text-base font-semibold tracking-[-0.02em]">{item.company}</p>
                          <span className="shrink-0 lg:hidden">
                            <ExpiryBadge status={item.status} label={t(badge.key as Parameters<typeof t>[0], badge.values)} />
                          </span>
                        </div>
                        <p className="mt-1.5 flex min-w-0 items-center gap-2 text-sm">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${toneDotClass(toneForCategory(item.category))}`} />
                          <span className="shrink-0 font-semibold">{short}</span>
                          {short !== full && <span className="truncate text-ink-muted">{categoryNameWithoutAbbreviation(full)}</span>}
                          {item.clientName && <span className="hidden shrink-0 text-xs text-ink-faint xl:inline">· {item.clientName}</span>}
                        </p>
                      </div>

                      <div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-line">
                          <div className={`h-full rounded-full ${EXPIRY_STATUS_STYLES[item.status].bar}`} style={{ width: `${Math.max(3, progress * 100)}%` }} />
                        </div>
                        <div className="mt-2 flex justify-between gap-3 text-[11px] tabular-nums text-ink-muted">
                          <span>
                            {t("monitoredShort")} {formatServiceDate(item.serviceDate, intlLocale)}
                          </span>
                          <span className={item.status === "expired" ? "font-semibold text-danger" : "font-semibold text-ink"}>
                            {t("expiresShort")} {formatServiceDate(item.expiryDate, intlLocale)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-line pt-3 lg:border-0 lg:pt-0">
                        {/* Desktop-only copy of the badge (mobile shows it next to the company). Wrapped so `hidden` isn't fighting the badge's own inline-flex. */}
                        <span className="mr-2 hidden lg:block">
                          <ExpiryBadge status={item.status} label={t(badge.key as Parameters<typeof t>[0], badge.values)} />
                        </span>
                        <Link href={`/records/${item.id}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-accent">
                          {t("viewReport")} <Arrow className="h-3.5 w-3.5" />
                        </Link>
                        {item.status !== "valid" && (
                          <Link
                            href={{ pathname: `/records/${item.id}`, query: { renew: item.category } }}
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 ${
                              item.status === "expired" ? "bg-danger hover:opacity-90" : "bg-brand hover:bg-brand-hover"
                            }`}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> {t("renewNow")}
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
