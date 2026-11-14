import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { CountUp } from "@/app/_components/count-up";
import { Activity, Arrow, Check, File, Inbox, Paperclip, Upload, Users } from "@/app/_components/icons";
import { Reveal } from "@/app/_components/reveal";
import { SpotlightCard } from "@/app/_components/spotlight-card";
import { Link } from "@/i18n/routing";
import { toneBadgeClass, toneForCategory } from "@/lib/format";
import type { WorkspaceData, WorkspaceRecord } from "@/lib/supabase/queries";

const CARD = "rounded-[1.5rem] border border-line bg-surface shadow-[0_18px_44px_rgba(16,42,51,.06)]";

export async function WorkspaceBento({ data, isAdmin, renewalAlerts }: { data: WorkspaceData; isAdmin: boolean; renewalAlerts: number }) {
  const [t, tCategories] = await Promise.all([getTranslations("workspace"), getTranslations("categories.items")]);

  function categoryLabel(category: string | null) {
    if (!category) return t("noReport");
    try {
      return tCategories(category);
    } catch {
      return category;
    }
  }

  const pending = data.pendingApprovals;
  const queueIsEmpty = (pending?.count ?? 0) === 0 && data.myIncompleteCount === 0;
  const peak = Math.max(1, ...data.dailyDocuments);
  const delta = data.thisWeekDocuments - data.lastWeekDocuments;
  const deltaPercent = data.lastWeekDocuments > 0 ? Math.round((delta / data.lastWeekDocuments) * 100) : null;
  const today = data.dailyDocuments[data.dailyDocuments.length - 1] ?? 0;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Activity pulse */}
      <Reveal className="lg:col-span-7">
        <SpotlightCard className={`${CARD} flex h-full flex-col p-6 sm:p-7`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent">{t("pulseEyebrow")}</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">{t("pulseTitle")}</h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Activity className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="text-5xl font-semibold tracking-[-0.06em] tabular-nums">
                <CountUp value={data.thisWeekDocuments} />
              </p>
              <p className="mt-1 text-sm text-ink-muted">{t("thisWeek")}</p>
            </div>
            <div className="pb-1">
              {data.lastWeekDocuments === 0 && data.thisWeekDocuments === 0 ? (
                <span className="text-sm text-ink-muted">{t("pulseEmpty")}</span>
              ) : delta === 0 ? (
                <span className="inline-flex items-center rounded-full bg-badge-neutral-bg px-2.5 py-1 text-xs font-semibold text-badge-neutral-text">{t("pulseFlat")}</span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${delta > 0 ? "bg-accent-soft text-accent" : "bg-amber-soft text-amber"}`}
                >
                  <span aria-hidden="true">{delta > 0 ? "↗" : "↘"}</span>
                  {deltaPercent === null ? `+${delta}` : `${delta > 0 ? "+" : ""}${deltaPercent}%`} {t("vsLastWeek")}
                </span>
              )}
            </div>
          </div>

          <div className="mt-auto pt-8">
            <div className="flex h-28 items-end gap-1.5 sm:h-36 sm:gap-2" role="img" aria-label={t("pulseAria", { count: data.thisWeekDocuments + data.lastWeekDocuments })}>
              {data.dailyDocuments.map((value, index) => {
                const isToday = index === data.dailyDocuments.length - 1;
                const height = value === 0 ? 6 : Math.max(14, Math.round((value / peak) * 100));
                return (
                  <div key={index} className="group/bar relative flex h-full flex-1 items-end">
                    <div
                      className={`w-full origin-bottom rounded-md transition-colors animate-[grow-up_.7s_cubic-bezier(.22,1,.36,1)_both] ${
                        value === 0 ? "bg-line" : isToday ? "bg-accent" : "bg-accent/55 group-hover/bar:bg-accent"
                      }`}
                      style={{ height: `${height}%`, animationDelay: `${index * 35}ms` }}
                    />
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-brand px-1.5 py-0.5 font-mono text-[10px] font-semibold text-on-brand opacity-0 transition-opacity group-hover/bar:opacity-100">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] tracking-wide text-ink-faint">
              <span>{t("daysAgo", { count: data.dailyDocuments.length - 1 })}</span>
              <span className="text-accent">
                {t("today")} · {today}
              </span>
            </div>
          </div>
        </SpotlightCard>
      </Reveal>

      {/* Totals */}
      <Reveal className="lg:col-span-5" delay={0.08}>
        <div className="grid h-full gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <SpotlightCard className={`${CARD} relative flex flex-col overflow-hidden p-6`}>
            {/* `.spotlight > *` forces direct children to position: relative, so the
                absolute glow has to sit one level down inside a zero-height wrapper
                or it takes up layout space. */}
            <div className="pointer-events-none h-0" aria-hidden="true">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-accent-soft blur-2xl" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-muted">{t("totalRecords")}</p>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <File className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-auto pt-6 text-5xl font-semibold tracking-[-0.06em] tabular-nums">
              <CountUp value={data.totalDocuments} />
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
              <Users className="h-4 w-4 text-accent" />
              {t("clientsCount", { count: data.totalClients })}
            </p>
          </SpotlightCard>

          <SpotlightCard className={`${CARD} flex flex-col p-6 ${queueIsEmpty && renewalAlerts === 0 ? "" : "border-amber/30"}`}>
            <div className="flex items-start justify-between gap-4">
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-muted">{t("needsAttention")}</p>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${queueIsEmpty && renewalAlerts === 0 ? "bg-accent-soft text-accent" : "bg-amber-soft text-amber"}`}>
                {queueIsEmpty && renewalAlerts === 0 ? <Check className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
              </span>
            </div>
            <p className={`mt-auto pt-6 text-5xl font-semibold tracking-[-0.06em] tabular-nums ${queueIsEmpty && renewalAlerts === 0 ? "" : "text-amber"}`}>
              <CountUp value={data.myIncompleteCount + (pending?.count ?? 0) + renewalAlerts} />
            </p>
            <p className="mt-2 text-sm text-ink-muted">{queueIsEmpty && renewalAlerts === 0 ? t("allClearHint") : t("needsAttentionHint")}</p>
          </SpotlightCard>
        </div>
      </Reveal>

      {/* Waiting on you */}
      <Reveal className="lg:col-span-5" delay={0.05}>
        <section className={`${CARD} flex h-full flex-col p-6 sm:p-7`} aria-labelledby="queue-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-amber">{t("waitingEyebrow")}</p>
              <h2 id="queue-title" className="mt-2 text-lg font-semibold tracking-[-0.03em]">
                {t("waitingTitle")}
              </h2>
            </div>
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${queueIsEmpty ? "bg-accent-soft text-accent" : "bg-amber-soft text-amber"}`}>
              {queueIsEmpty ? <Check className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
            </span>
          </div>

          {queueIsEmpty ? (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
                <Check className="h-6 w-6" />
              </span>
              <p className="mt-4 font-semibold">{t("allClear")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("allClearHint")}</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {pending && pending.count > 0 && (
                <li className="rounded-2xl border border-amber/25 bg-amber-soft/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{t("pendingApprovals", { count: pending.count })}</p>
                      <p className="mt-1 truncate text-xs text-ink-muted">{pending.names.join(" · ")}</p>
                    </div>
                    <NextLink
                      href="/admin/staff"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
                    >
                      {t("review")} <Arrow className="h-3.5 w-3.5" />
                    </NextLink>
                  </div>
                </li>
              )}
              {data.myIncompleteCount > 0 && (
                <li className="rounded-2xl border border-line bg-surface-soft p-4">
                  <p className="text-sm font-semibold">{t("incompleteRecords", { count: data.myIncompleteCount })}</p>
                  <ul className="mt-3 space-y-2">
                    {data.myIncomplete.map((record) => (
                      <li key={record.id}>
                        <Link
                          href={`/records/${record.id}`}
                          className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 transition-all hover:-translate-y-0.5 hover:border-accent"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{record.company}</span>
                            <span className="block truncate text-xs text-ink-muted">{record.clientName}</span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                            <Paperclip className="h-3.5 w-3.5" /> {t("attachReport")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          )}
        </section>
      </Reveal>

      {/* Your recent records */}
      <Reveal className="lg:col-span-7" delay={0.12}>
        <section id="mine" className={`${CARD} flex h-full scroll-mt-24 flex-col p-6 sm:p-7`} aria-labelledby="mine-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent">{t("recentEyebrow")}</p>
              <h2 id="mine-title" className="mt-2 text-lg font-semibold tracking-[-0.03em]">
                {t("recentTitle")}
              </h2>
            </div>
            <Link
              href="/submit"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3.5 py-2 text-xs font-semibold transition-colors hover:border-accent hover:text-accent"
            >
              <Upload className="h-3.5 w-3.5" /> {t("newReport")}
            </Link>
          </div>

          {data.myRecent.length === 0 ? (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
              <p className="font-semibold">{t("recentEmpty")}</p>
              <p className="mt-1 max-w-xs text-sm text-ink-muted">{t("recentEmptyHint")}</p>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-line">
              {data.myRecent.map((record) => (
                <RecentRow key={record.id} record={record} label={categoryLabel(record.category)} countLabel={t("documentsCount", { count: record.documentCount })} />
              ))}
            </ul>
          )}

          {isAdmin && data.myRecent.length > 0 && (
            <p className="mt-4 text-xs text-ink-faint">{t("recentFootnote")}</p>
          )}
        </section>
      </Reveal>
    </div>
  );
}

function RecentRow({ record, label, countLabel }: { record: WorkspaceRecord; label: string; countLabel: string }) {
  const badgeClass = record.category ? toneBadgeClass(toneForCategory(record.category)) : "bg-badge-neutral-bg text-badge-neutral-text";
  return (
    <li>
      <Link href={`/records/${record.id}`} className="group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3.5 transition-colors hover:bg-surface-soft">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface-soft">
          {record.thumbnailUrl ? (
            // Already a small, pre-sized JPEG from a known origin — next/image's
            // optimization pipeline isn't worth the images.remotePatterns config.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={record.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : record.fileType ? (
            <span className="font-mono text-[10px] font-bold text-accent">{record.fileType}</span>
          ) : (
            <Paperclip className="h-4 w-4 text-ink-faint" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{record.company}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${badgeClass}`}>{label}</span>
            <span>{record.clientName}</span>
            {record.documentCount > 1 && <span>· {countLabel}</span>}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs text-ink-muted sm:block">{record.date}</span>
        <Arrow className="h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
      </Link>
    </li>
  );
}
