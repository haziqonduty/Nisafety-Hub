"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { CategoryFilter } from "@/app/_components/category-filter";
import { ExpiryBadge, expiryLabel } from "@/app/_components/expiry-badge";
import { Arrow, Calendar, ChevronDown, Download, Paperclip, Search } from "@/app/_components/icons";
import { SpotlightCard } from "@/app/_components/spotlight-card";
import { Link } from "@/i18n/routing";
import { formatServiceDate, isRecentlySubmitted, shortCategoryLabel, todayInMalaysia, toneBadgeClass } from "@/lib/format";
import { DIRECTORY_SORTS, DIRECTORY_STATUSES, type DirectorySort, type DirectoryStatus } from "@/lib/directory";
import type { DirectoryDocument, DirectoryPage } from "@/lib/supabase/queries";
import { EXPIRY_STATUS_STYLES, expiryStatus } from "@/lib/validity";

const COLLAPSED_REPORTS = 3;

type ClientGroup = {
  clientId: string;
  company: string;
  clientName: string;
  /** Service reports, newest visit first. Empty for a client with no report yet. */
  reports: DirectoryDocument[];
  /** Every searchable string for this client and all of its reports. */
  haystack: string;
  /** Report ids that a newer report of the same service has replaced. */
  superseded: Set<string>;
  visits: number;
  latestActivity: string;
  hasRecent: boolean;
};

function groupByClient(documents: DirectoryDocument[]): ClientGroup[] {
  const groups = new Map<string, ClientGroup>();
  for (const document of documents) {
    let group = groups.get(document.clientId);
    if (!group) {
      group = { clientId: document.clientId, company: document.company, clientName: document.clientName, reports: [], haystack: "", superseded: new Set(), visits: 0, latestActivity: document.createdAt, hasRecent: false };
      groups.set(document.clientId, group);
    }
    if (document.hasDocument) group.reports.push(document);
    if (document.createdAt > group.latestActivity) group.latestActivity = document.createdAt;
    if (isRecentlySubmitted(document.createdAt)) group.hasRecent = true;
    group.haystack += ` ${[
      document.title,
      document.company,
      document.category ?? "",
      document.clientName,
      document.telephone,
      document.email,
      ...document.additionalClientNames,
      ...document.additionalTelephones,
      ...document.additionalEmails,
    ].join(" ")}`;
  }

  for (const group of groups.values()) {
    group.reports.sort((a, b) => (a.serviceDate === b.serviceDate ? (a.createdAt < b.createdAt ? 1 : -1) : (a.serviceDate ?? "") < (b.serviceDate ?? "") ? 1 : -1));
    group.visits = new Set(group.reports.map((report) => report.serviceDate)).size;
    const seenCategories = new Set<string>();
    for (const report of group.reports) {
      if (seenCategories.has(report.category ?? "")) group.superseded.add(report.id);
      else seenCategories.add(report.category ?? "");
    }
    group.haystack = group.haystack.toLowerCase();
  }

  // Clients arrive in the order the server sorted them; a Map keeps that order.
  return [...groups.values()];
}

const ALL = "All records";
const SEARCH_DEBOUNCE_MS = 250;

type DirectoryQuery = { query: string; category: string; status: DirectoryStatus | null; sort: DirectorySort };

function directoryUrl({ query, category, status, sort }: DirectoryQuery, offset: number) {
  const params = new URLSearchParams({ offset: String(offset) });
  if (query.trim()) params.set("q", query.trim());
  if (category !== ALL) params.set("category", category);
  if (status) params.set("status", status);
  if (sort !== "recent") params.set("sort", sort);
  return `/api/directory?${params}`;
}

function statusDotClass(status: DirectoryStatus) {
  return status === "no_report" ? "bg-ink-faint" : EXPIRY_STATUS_STYLES[status].dot;
}

/** Appends a page, skipping any report already shown (a client can move between pages if it gets new activity). */
function mergeDocuments(current: DirectoryDocument[], next: DirectoryDocument[]) {
  const seen = new Set(current.map((document) => document.id));
  return [...current, ...next.filter((document) => !seen.has(document.id))];
}

export function DirectoryExplorer({ initialPage }: { initialPage: DirectoryPage }) {
  const t = useTranslations("directory");
  const tServices = useTranslations("services");
  const tExpiry = useTranslations("expiry");
  const today = todayInMalaysia();
  const tCategories = useTranslations("categories.items");
  const locale = useLocale();
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState<DirectoryStatus | null>(null);
  const [sort, setSort] = useState<DirectorySort>("recent");
  const [statusCounts, setStatusCounts] = useState(initialPage.statusCounts);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Search and filtering run in the database across every record; this
  // holds the pages loaded so far for the current search.
  const [documents, setDocuments] = useState(initialPage.documents);
  const [total, setTotal] = useState(initialPage.total);
  const [loadedClients, setLoadedClients] = useState(initialPage.clientCount);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // The server already rendered page one of the unfiltered directory.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(directoryUrl({ query, category, status, sort }, 0), { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const page = (await response.json()) as DirectoryPage;
        setDocuments(page.documents);
        setTotal(page.total);
        setLoadedClients(page.clientCount);
        setStatusCounts(page.statusCounts ?? {});
        setExpanded(new Set());
        setLoadError(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, category, status, sort]);

  async function loadMore() {
    setLoadingMore(true);
    setLoadError(false);
    try {
      const response = await fetch(directoryUrl({ query, category, status, sort }, loadedClients));
      if (!response.ok) throw new Error(String(response.status));
      const page = (await response.json()) as DirectoryPage;
      setDocuments((current) => mergeDocuments(current, page.documents));
      setLoadedClients((count) => count + page.clientCount);
      if (page.total) setTotal(page.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function categoryLabel(value: string | null) {
    if (!value) return t("clientOnlyBadge");
    try {
      return tCategories(value);
    } catch {
      return value;
    }
  }

  const clients = useMemo(() => groupByClient(documents), [documents]);
  const allCount = Object.values(statusCounts).reduce((sum, count) => sum + (count ?? 0), 0);
  const hasFilters = Boolean(query.trim()) || category !== ALL || status !== null;

  // Already filtered by the server.
  const visibleClients = clients;
  const hasMore = loadedClients < total;

  function toggleExpanded(clientId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  return (
    <>
      <div className="mt-10 rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_rgba(16,42,51,.05)] sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft px-4 py-3.5 transition-shadow focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          {searching ? (
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
          ) : (
            <Search className="h-5 w-5 text-accent" />
          )}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchAriaLabel")}
          />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="hidden shrink-0 whitespace-nowrap rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-faint transition-colors hover:border-accent hover:text-accent sm:inline"
            aria-label={t("openCommandPalette")}
          >
            ⌘ K
          </button>
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CategoryFilter category={category} onChange={setCategory} className="" />
          <label className="relative flex items-center gap-2 text-sm">
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint">{t("sortLabel")}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as DirectorySort)}
              className="w-full appearance-none rounded-xl border border-line bg-surface py-2.5 pl-3.5 pr-9 text-sm font-semibold text-ink transition hover:border-accent-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft sm:w-auto"
            >
              {DIRECTORY_SORTS.map((option) => (
                <option key={option} value={option}>
                  {t(`sort.${option}`)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-ink-faint" />
          </label>
        </div>

        <div role="group" aria-label={t("statusLabel")} className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {[null, ...DIRECTORY_STATUSES].map((option) => {
            const count = option === null ? allCount : (statusCounts[option] ?? 0);
            const active = status === option;
            return (
              <button
                key={option ?? "all"}
                type="button"
                aria-pressed={active}
                disabled={!active && option !== null && count === 0}
                onClick={() => setStatus(option)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? "border-accent bg-accent-soft text-accent shadow-[0_6px_16px_rgba(16,42,51,.08)]" : "border-line bg-surface text-ink-muted hover:border-accent-soft hover:text-ink"
                }`}
              >
                {option && <span className={`h-2 w-2 rounded-full ${statusDotClass(option)}`} aria-hidden="true" />}
                {t(`status.${option ?? "all"}`)}
                <span className={`rounded-md px-1.5 py-px font-mono text-[10px] tabular-nums ${active ? "bg-surface text-accent" : "bg-surface-soft text-ink-faint"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink tabular-nums">{total}</span> {t("matchingClients", { count: total })}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(ALL);
              setStatus(null);
            }}
            className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      <div aria-busy={searching} className={`mt-5 grid gap-4 transition-opacity duration-200 lg:grid-cols-2 ${searching ? "opacity-50" : ""}`}>
        {visibleClients.map((client) => {
          const filtering = category !== ALL;
          const reports = filtering ? client.reports.filter((report) => report.category === category) : client.reports;
          const hiddenByFilter = client.reports.length - reports.length;
          const isExpanded = expanded.has(client.clientId);
          const shown = isExpanded ? reports : reports.slice(0, COLLAPSED_REPORTS);
          const latest = client.reports[0];
          const profileHref = `/records/${latest?.id ?? client.clientId}`;

          return (
            <SpotlightCard
              as="article"
              key={client.clientId}
              className="group/card flex flex-col rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-soft hover:shadow-[0_18px_38px_rgba(16,42,51,.09)] sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <Link href={profileHref} className="min-w-0">
                  {client.reports.length === 0 ? (
                    <ViewTransition name={`client-${client.clientId}`}>
                      <h3 className="truncate text-lg font-semibold tracking-[-0.03em]">{client.company}</h3>
                    </ViewTransition>
                  ) : (
                    <h3 className="truncate text-lg font-semibold tracking-[-0.03em]">{client.company}</h3>
                  )}
                  <p className="mt-1 truncate text-sm text-ink-muted">{client.clientName}</p>
                </Link>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {client.hasRecent && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-soft px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide text-amber">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                      {t("newBadge")}
                    </span>
                  )}
                  {client.reports.length > 0 ? (
                    <span className="rounded-lg bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide text-accent">
                      {tServices("servicesCount", { count: client.reports.length })}
                    </span>
                  ) : (
                    <span className="rounded-lg bg-badge-neutral-bg px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide text-badge-neutral-text">{t("clientOnlyBadge")}</span>
                  )}
                </div>
              </div>

              {client.reports.length === 0 ? (
                <Link
                  href={profileHref}
                  className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-4 text-sm text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <Paperclip className="h-4 w-4" /> {tServices("noServicesCardHint")}
                </Link>
              ) : (
                <ul className="mt-5 space-y-2">
                  {shown.map((report) => {
                    const full = categoryLabel(report.category);
                    return (
                      <li key={report.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft p-2.5 pr-3 transition-colors hover:border-accent-soft">
                        <Link href={`/records/${report.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface">
                            {report.thumbnailUrl ? (
                              // Already a small, pre-sized JPEG from a known origin — next/image's
                              // optimization pipeline isn't worth the images.remotePatterns config.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={report.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-mono text-[10px] font-bold text-accent">{report.fileType}</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <ViewTransition name={`document-${report.id}`}>
                              <span className="block truncate text-sm font-semibold">{report.title}</span>
                            </ViewTransition>
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                              <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${toneBadgeClass(report.tone!)}`} title={full}>
                                {shortCategoryLabel(full)}
                              </span>
                              {report.serviceDate && (
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Calendar className="h-3 w-3" />
                                  {formatServiceDate(report.serviceDate, intlLocale)}
                                </span>
                              )}
                              {(report.expiryDate || client.superseded.has(report.id)) &&
                                (() => {
                                  const { status, daysLeft } = expiryStatus(report.expiryDate, today, client.superseded.has(report.id));
                                  const label = expiryLabel(status, daysLeft);
                                  return <ExpiryBadge status={status} label={tExpiry(label.key as Parameters<typeof tExpiry>[0], label.values)} />;
                                })()}
                            </span>
                          </span>
                        </Link>
                        <a
                          href={report.publicUrl!}
                          download
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
                          aria-label={t("download", { title: report.title })}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}

              {(reports.length > COLLAPSED_REPORTS || hiddenByFilter > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {reports.length > COLLAPSED_REPORTS && (
                    <button type="button" onClick={() => toggleExpanded(client.clientId)} className="font-semibold text-accent transition-colors hover:text-accent-hover">
                      {isExpanded ? tServices("showLess") : tServices("showMore", { count: reports.length - COLLAPSED_REPORTS })}
                    </button>
                  )}
                  {hiddenByFilter > 0 && <span className="text-ink-muted">{tServices("otherServicesHidden", { count: hiddenByFilter })}</span>}
                </div>
              )}

              <div className="flex-1" aria-hidden="true" />
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-ink-muted">
                <span>
                  {client.reports.length > 0 && latest?.serviceDate
                    ? tServices("lastVisit", { date: formatServiceDate(latest.serviceDate, intlLocale), visits: client.visits })
                    : t("clientOnlyBadge")}
                </span>
                <Link href={profileHref} className="inline-flex items-center gap-1 font-semibold text-accent transition-colors hover:text-accent-hover">
                  {tServices("viewClient")} <Arrow className="h-3.5 w-3.5 transition-transform group-hover/card:translate-x-0.5" />
                </Link>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
      {visibleClients.length === 0 && !searching && (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">
          {!hasFilters ? t("emptyNoRecords") : t("emptyNoMatch")}
        </div>
      )}

      {visibleClients.length > 0 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-ink-muted tabular-nums">{t("showingOf", { shown: Math.min(loadedClients, total), total })}</p>
          <div className="h-1 w-48 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${total ? Math.min(100, (loadedClients / total) * 100) : 100}%` }} />
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore || searching}
              className="mt-1 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_8px_20px_rgba(16,42,51,.06)] transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:translate-y-0 disabled:opacity-60"
            >
              {loadingMore && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />}
              {loadingMore ? t("loadingMore") : t("loadMore", { count: Math.min(24, total - loadedClients) })}
            </button>
          )}
          {loadError && (
            <p role="alert" className="text-xs font-medium text-danger">
              {t("loadError")}
            </p>
          )}
        </div>
      )}
    </>
  );
}
