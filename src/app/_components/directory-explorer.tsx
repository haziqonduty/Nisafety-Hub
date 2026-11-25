"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { CategoryFilter } from "@/app/_components/category-filter";
import { PaginationBar } from "@/app/_components/pagination-bar";
import { ExpiryBadge, expiryLabel } from "@/app/_components/expiry-badge";
import { Arrow, Calendar, ChevronDown, Download, Paperclip, Search } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import { categoryMessageKey, formatServiceDate, isRecentlySubmitted, shortCategoryLabel, todayInMalaysia, toneBadgeClass, toneForCategory } from "@/lib/format";
import { DEFAULT_DIRECTORY_PAGE_SIZE, DIRECTORY_SORTS, DIRECTORY_STATUSES, parseDirectoryPageSize, type DirectorySort, type DirectoryStatus } from "@/lib/directory";
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
  /** Services the client needs that have no report yet. */
  requested: string[];
};

function groupByClient(documents: DirectoryDocument[]): ClientGroup[] {
  const groups = new Map<string, ClientGroup>();
  for (const document of documents) {
    let group = groups.get(document.clientId);
    if (!group) {
      group = { clientId: document.clientId, company: document.company, clientName: document.clientName, reports: [], haystack: "", superseded: new Set(), visits: 0, latestActivity: document.createdAt, hasRecent: false, requested: document.requestedServices ?? [] };
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
    const reported = new Set(group.reports.map((report) => report.category));
    group.requested = group.requested.filter((category) => !reported.has(category));
  }

  // Clients arrive in the order the server sorted them; a Map keeps that order.
  return [...groups.values()];
}

const ALL = "All records";
const SEARCH_DEBOUNCE_MS = 250;

type DirectoryQuery = { query: string; category: string; status: DirectoryStatus | null; sort: DirectorySort };

function directoryUrl({ query, category, status, sort }: DirectoryQuery, offset: number, limit: number) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (query.trim()) params.set("q", query.trim());
  if (category !== ALL) params.set("category", category);
  if (status) params.set("status", status);
  if (sort !== "recent") params.set("sort", sort);
  return `/api/directory?${params}`;
}

function statusDotClass(status: DirectoryStatus) {
  return status === "no_report" ? "bg-ink-faint" : EXPIRY_STATUS_STYLES[status].dot;
}

const PAGE_SIZE_KEY = "nisafety.directory.pageSize";

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
  // Search, filtering, sorting and paging all run in the database; this
  // holds the one page currently shown.
  const [documents, setDocuments] = useState(initialPage.documents);
  const [total, setTotal] = useState(initialPage.total);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_DIRECTORY_PAGE_SIZE);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const isFirstRun = useRef(true);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Each computer remembers the page size staff last picked.
  useEffect(() => {
    try {
      const saved = parseDirectoryPageSize(window.localStorage.getItem(PAGE_SIZE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a saved preference after hydration
      if (saved !== DEFAULT_DIRECTORY_PAGE_SIZE) setPageSize(saved);
    } catch {
      // Storage blocked (private window) - keep the default.
    }
  }, []);

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
        const response = await fetch(directoryUrl({ query, category, status, sort }, (page - 1) * pageSize, pageSize), { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const result = (await response.json()) as DirectoryPage;
        setDocuments(result.documents);
        setTotal(result.total);
        setStatusCounts(result.statusCounts ?? {});
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
  }, [query, category, status, sort, page, pageSize]);

  // Any change to what's being looked for starts again from page 1.
  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }
  function updateCategory(value: string) {
    setCategory(value);
    setPage(1);
  }
  function updateStatus(value: DirectoryStatus | null) {
    setStatus(value);
    setPage(1);
  }
  function updateSort(value: DirectorySort) {
    setSort(value);
    setPage(1);
  }
  function updatePageSize(value: number) {
    setPageSize(value);
    setPage(1);
    try {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(value));
    } catch {
      // Not saved - it still applies for this visit.
    }
  }
  function goToPage(next: number) {
    setPage(next);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function categoryLabel(value: string | null) {
    if (!value) return t("clientOnlyBadge");
    try {
      return tCategories(categoryMessageKey(value));
    } catch {
      return value;
    }
  }

  const clients = useMemo(() => groupByClient(documents), [documents]);
  const allCount = Object.values(statusCounts).reduce((sum, count) => sum + (count ?? 0), 0);
  const hasFilters = Boolean(query.trim()) || category !== ALL || status !== null;

  // Already filtered by the server.
  const visibleClients = clients;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

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
            onChange={(event) => updateQuery(event.target.value)}
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
          <CategoryFilter category={category} onChange={updateCategory} className="" />
          <label className="relative flex items-center gap-2 text-sm">
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint">{t("sortLabel")}</span>
            <select
              value={sort}
              onChange={(event) => updateSort(event.target.value as DirectorySort)}
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
                onClick={() => updateStatus(option)}
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
      <div ref={resultsRef} className="mt-8 flex scroll-mt-6 items-center justify-between">
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
              setPage(1);
            }}
            className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      <div aria-busy={searching} className={`mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 transition-opacity duration-200 lg:grid-cols-2 ${searching ? "opacity-50" : ""}`}>
        {visibleClients.map((client) => {
          const filtering = category !== ALL;
          const reports = filtering ? client.reports.filter((report) => report.category === category) : client.reports;
          const hiddenByFilter = client.reports.length - reports.length;
          const isExpanded = expanded.has(client.clientId);
          const shown = isExpanded ? reports : reports.slice(0, COLLAPSED_REPORTS);
          const latest = client.reports[0];
          const profileHref = `/records/${latest?.id ?? client.clientId}`;
          const clientOnly = client.reports.length === 0;

          return (
            <article
              key={client.clientId}
              className="group/card flex flex-col rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors duration-200 hover:border-accent-soft sm:px-5 sm:py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Link href={profileHref} className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    {clientOnly ? (
                      <ViewTransition name={`client-${client.clientId}`}>
                        <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.02em] transition-colors group-hover/card:text-accent">{client.company}</h3>
                      </ViewTransition>
                    ) : (
                      <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.02em] transition-colors group-hover/card:text-accent">{client.company}</h3>
                    )}
                    {client.hasRecent && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-soft px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wide text-amber">
                        <span className="h-1 w-1 rounded-full bg-amber" aria-hidden="true" />
                        {t("newBadge")}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">{client.clientName}</span>
                </Link>
                {!clientOnly && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
                    {tServices("servicesCount", { count: client.reports.length })}
                  </span>
                )}
              </div>

              {!clientOnly && (
                <ul className="mt-3 divide-y divide-line/70 border-t border-line/70">
                  {shown.map((report) => {
                    const full = categoryLabel(report.category);
                    return (
                      <li key={report.id} className="flex items-center gap-3 py-2">
                        <Link href={`/records/${report.id}`} className="group/row flex min-w-0 flex-1 items-center gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-soft">
                            {report.thumbnailUrl ? (
                              // Already a small, pre-sized JPEG from a known origin — next/image's
                              // optimization pipeline isn't worth the images.remotePatterns config.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={report.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-mono text-[9px] font-bold text-accent">{report.fileType}</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <ViewTransition name={`document-${report.id}`}>
                              <span className="block truncate text-[13px] font-medium transition-colors group-hover/row:text-accent">{report.title}</span>
                            </ViewTransition>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
                              <span className={`rounded px-1 py-px font-mono text-[9px] font-bold ${toneBadgeClass(report.tone!)}`} title={full}>
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
                                  const { status, daysLeft } = expiryStatus(report.expiryDate, today, client.superseded.has(report.id), report.renewalClosed);
                                  const label = expiryLabel(status, daysLeft);
                                  return <ExpiryBadge status={status} label={tExpiry(label.key as Parameters<typeof tExpiry>[0], label.values)} />;
                                })()}
                            </span>
                          </span>
                        </Link>
                        <a
                          href={report.publicUrl!}
                          download
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent"
                          aria-label={t("download", { title: report.title })}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}

              {(reports.length > COLLAPSED_REPORTS || hiddenByFilter > 0) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  {reports.length > COLLAPSED_REPORTS && (
                    <button type="button" onClick={() => toggleExpanded(client.clientId)} className="font-semibold text-accent transition-colors hover:text-accent-hover">
                      {isExpanded ? tServices("showLess") : tServices("showMore", { count: reports.length - COLLAPSED_REPORTS })}
                    </button>
                  )}
                  {hiddenByFilter > 0 && <span className="text-ink-muted">{tServices("otherServicesHidden", { count: hiddenByFilter })}</span>}
                </div>
              )}

              <div className="flex-1" aria-hidden="true" />
              <div className={`flex items-center justify-between gap-3 text-[11px] text-ink-muted ${clientOnly ? "mt-2.5" : "mt-2 border-t border-line/70 pt-2.5"}`}>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {clientOnly ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-ink-faint">
                        <Paperclip className="h-3 w-3" />
                        {t("noReportsYet")}
                      </span>
                      {client.requested.length > 0 && (
                        <>
                          <span className="text-ink-faint" aria-hidden="true">·</span>
                          <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-ink-faint">{tServices("requestedShort")}</span>
                          {client.requested.map((category) => (
                            <span key={category} title={categoryLabel(category)} className={`rounded px-1 py-px font-mono text-[9px] font-bold ${toneBadgeClass(toneForCategory(category))}`}>
                              {shortCategoryLabel(categoryLabel(category))}
                            </span>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {latest?.serviceDate && <span>{tServices("lastVisit", { date: formatServiceDate(latest.serviceDate, intlLocale), visits: client.visits })}</span>}
                      {client.requested.length > 0 && (
                        <>
                          <span className="text-ink-faint" aria-hidden="true">·</span>
                          <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-ink-faint">{tServices("requestedShort")}</span>
                          {client.requested.map((category) => (
                            <span key={category} title={categoryLabel(category)} className={`rounded px-1 py-px font-mono text-[9px] font-bold ${toneBadgeClass(toneForCategory(category))}`}>
                              {shortCategoryLabel(categoryLabel(category))}
                            </span>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </span>
                <Link href={profileHref} className="inline-flex shrink-0 items-center gap-1 font-semibold text-accent transition-colors hover:text-accent-hover">
                  {tServices("viewClient")} <Arrow className="h-3 w-3 transition-transform group-hover/card:translate-x-0.5" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {visibleClients.length === 0 && !searching && (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">
          {!hasFilters ? t("emptyNoRecords") : t("emptyNoMatch")}
        </div>
      )}

      {(visibleClients.length > 0 || page > 1) && (
        <PaginationBar
          page={page}
          lastPage={lastPage}
          pageSize={pageSize}
          onPage={goToPage}
          onPageSize={updatePageSize}
          disabled={searching}
          labels={{
            nav: t("pagination"),
            range: t("range", { from: firstShown, to: lastShown, total }),
            previous: t("previousPage"),
            next: t("nextPage"),
            page: (number) => t("pageLabel", { page: number }),
            show: t("perPageShow"),
            perPage: t("perPageSuffix"),
          }}
        >
          {loadError && (
            <p role="alert" className="basis-full text-center text-xs font-medium text-danger">
              {t("loadError")}
            </p>
          )}
        </PaginationBar>
      )}
    </>
  );
}
