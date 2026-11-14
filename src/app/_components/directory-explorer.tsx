"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, ViewTransition } from "react";
import { CategoryFilter } from "@/app/_components/category-filter";
import { Arrow, Calendar, Download, Paperclip, Search } from "@/app/_components/icons";
import { SpotlightCard } from "@/app/_components/spotlight-card";
import { Link } from "@/i18n/routing";
import { formatServiceDate, isRecentlySubmitted, shortCategoryLabel, toneBadgeClass } from "@/lib/format";
import type { DirectoryDocument } from "@/lib/supabase/queries";

const COLLAPSED_REPORTS = 3;

type ClientGroup = {
  clientId: string;
  company: string;
  clientName: string;
  /** Service reports, newest visit first. Empty for a client with no report yet. */
  reports: DirectoryDocument[];
  /** Every searchable string for this client and all of its reports. */
  haystack: string;
  visits: number;
  latestActivity: string;
  hasRecent: boolean;
};

function groupByClient(documents: DirectoryDocument[]): ClientGroup[] {
  const groups = new Map<string, ClientGroup>();
  for (const document of documents) {
    let group = groups.get(document.clientId);
    if (!group) {
      group = { clientId: document.clientId, company: document.company, clientName: document.clientName, reports: [], haystack: "", visits: 0, latestActivity: document.createdAt, hasRecent: false };
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
    group.haystack = group.haystack.toLowerCase();
  }

  return [...groups.values()].sort((a, b) => (a.latestActivity < b.latestActivity ? 1 : -1));
}

export function DirectoryExplorer({ documents }: { documents: DirectoryDocument[] }) {
  const t = useTranslations("directory");
  const tServices = useTranslations("services");
  const tCategories = useTranslations("categories.items");
  const locale = useLocale();
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All records");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function categoryLabel(value: string | null) {
    if (!value) return t("clientOnlyBadge");
    try {
      return tCategories(value);
    } catch {
      return value;
    }
  }

  const clients = useMemo(() => groupByClient(documents), [documents]);

  const visibleClients = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    return clients.filter(
      (client) =>
        (category === "All records" || client.reports.some((report) => report.category === category)) && (!normalisedQuery || client.haystack.includes(normalisedQuery)),
    );
  }, [category, clients, query]);

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
          <Search className="h-5 w-5 text-accent" />
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
        <CategoryFilter category={category} onChange={setCategory} />
      </div>
      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{visibleClients.length}</span> {t("matchingClients", { count: visibleClients.length })}
        </p>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setCategory("All records");
          }}
          className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
        >
          {t("clearFilters")}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {visibleClients.map((client) => {
          const filtering = category !== "All records";
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
      {visibleClients.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">
          {documents.length === 0 ? t("emptyNoRecords") : t("emptyNoMatch")}
        </div>
      )}
    </>
  );
}
