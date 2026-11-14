import { getLocale, getTranslations } from "next-intl/server";
import { ExpiryBadge, expiryLabel } from "@/app/_components/expiry-badge";
import { Arrow } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import { categoryNameWithoutAbbreviation, formatServiceDate, shortCategoryLabel, todayInMalaysia, toneDotClass, toneForCategory } from "@/lib/format";
import type { ServiceHistoryEntry } from "@/lib/supabase/queries";
import { expiryStatus } from "@/lib/validity";

type Visit = { date: string; services: ServiceHistoryEntry[] };

function groupByVisit(history: ServiceHistoryEntry[]): Visit[] {
  const visits: Visit[] = [];
  for (const entry of history) {
    const last = visits[visits.length - 1];
    if (last && last.date === entry.serviceDate) last.services.push(entry);
    else visits.push({ date: entry.serviceDate, services: [entry] });
  }
  return visits;
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * A client's service history as a vertical timeline — one node per visit
 * (service date), with every service done that day listed under it. Answers
 * "what have we done for this client, and when" at a glance.
 */
export async function ServiceTimeline({ history, currentId }: { history: ServiceHistoryEntry[]; currentId: string }) {
  const [t, tExpiry, tCategories, locale] = await Promise.all([getTranslations("services"), getTranslations("expiry"), getTranslations("categories.items"), getLocale()]);
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const today = todayInMalaysia();
  const visits = groupByVisit(history);
  const uniqueServices = new Set(history.map((entry) => entry.category)).size;
  // Newest-first, so the first report seen per category is its latest; any
  // older report of the same service has been renewed.
  const latestPerCategory = new Set<string>();
  const superseded = new Set<string>();
  for (const entry of history) {
    if (latestPerCategory.has(entry.category)) superseded.add(entry.id);
    else latestPerCategory.add(entry.category);
  }

  function label(category: string) {
    try {
      return tCategories(category);
    } catch {
      return category;
    }
  }

  function relative(date: string) {
    const days = daysBetween(date, today);
    if (days <= 0) return t("today");
    if (days === 1) return t("yesterday");
    if (days < 60) return t("daysAgo", { count: days });
    return null;
  }

  if (visits.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-line px-6 py-8 text-center">
        <p className="text-sm font-semibold">{t("noServicesYet")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("noServicesYetHint")}</p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 text-accent">{t("servicesCount", { count: history.length })}</span>
        <span className="rounded-full bg-badge-neutral-bg px-3 py-1.5 text-badge-neutral-text">{t("visitsCount", { count: visits.length })}</span>
        {uniqueServices !== history.length && <span className="rounded-full bg-badge-neutral-bg px-3 py-1.5 text-badge-neutral-text">{t("serviceTypesCount", { count: uniqueServices })}</span>}
      </div>

      <ol className="relative mt-6">
        {visits.map((visit, index) => {
          const isLast = index === visits.length - 1;
          const when = relative(visit.date);
          return (
            <li key={visit.date} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0">
              {/* rail */}
              {!isLast && <span className="absolute bottom-0 left-[0.6rem] top-5 w-px bg-gradient-to-b from-accent/50 to-line" aria-hidden="true" />}
              <span className={`relative mt-1 grid h-5 w-5 place-items-center rounded-full ${index === 0 ? "bg-accent shadow-[0_0_0_5px_var(--accent-soft)]" : "border-2 border-accent/60 bg-surface"}`} aria-hidden="true">
                {index === 0 && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold tabular-nums">{formatServiceDate(visit.date, intlLocale)}</h3>
                  {when && <span className="text-xs text-ink-muted">{when}</span>}
                  {visit.services.length > 1 && (
                    <span className="rounded-full bg-amber-soft px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-amber">{t("sameVisit", { count: visit.services.length })}</span>
                  )}
                </div>

                <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                  {visit.services.map((service) => {
                    const isCurrent = service.id === currentId;
                    const full = label(service.category);
                    const short = shortCategoryLabel(full);
                    return (
                      <li key={service.id}>
                        <Link
                          href={`/records/${service.id}`}
                          aria-current={isCurrent ? "page" : undefined}
                          className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                            isCurrent ? "border-accent bg-accent-soft/60" : "border-line bg-surface-soft hover:-translate-y-0.5 hover:border-accent"
                          }`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${toneDotClass(toneForCategory(service.category))}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold" title={full}>
                              {short}
                              {short !== full && <span className="ml-1.5 font-normal text-ink-muted">{categoryNameWithoutAbbreviation(full)}</span>}
                            </span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-ink-muted">
                              <span className="truncate">{service.fileName}</span>
                              {(service.expiryDate || superseded.has(service.id)) &&
                                (() => {
                                  const { status, daysLeft } = expiryStatus(service.expiryDate, today, superseded.has(service.id));
                                  const label = expiryLabel(status, daysLeft);
                                  return <ExpiryBadge status={status} label={tExpiry(label.key as Parameters<typeof tExpiry>[0], label.values)} className="shrink-0" />;
                                })()}
                            </span>
                          </span>
                          {isCurrent ? (
                            <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-accent">{t("viewing")}</span>
                          ) : (
                            <Arrow className="h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
