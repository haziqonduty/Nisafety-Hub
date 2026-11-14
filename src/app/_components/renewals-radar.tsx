import { getLocale, getTranslations } from "next-intl/server";
import { CountUp } from "@/app/_components/count-up";
import { ExpiryBadge, expiryLabel } from "@/app/_components/expiry-badge";
import { Arrow, Hourglass, RefreshCw } from "@/app/_components/icons";
import { Reveal } from "@/app/_components/reveal";
import { Link } from "@/i18n/routing";
import { formatServiceDate, shortCategoryLabel, todayInMalaysia } from "@/lib/format";
import type { RenewalSummary } from "@/lib/supabase/queries";
import { EXPIRY_STATUS_STYLES, validityProgress } from "@/lib/validity";

const SHOWN = 5;

/** Workspace bento panel: renewal counts by urgency + the next services due. */
export async function RenewalsRadar({ renewals }: { renewals: RenewalSummary }) {
  const [t, tCategories, locale] = await Promise.all([getTranslations("expiry"), getTranslations("categories.items"), getLocale()]);
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const today = todayInMalaysia();
  const next = renewals.items.filter((item) => item.status !== "valid").slice(0, SHOWN);

  function label(category: string) {
    try {
      return tCategories(category);
    } catch {
      return category;
    }
  }

  const tiles = [
    { key: "expired", value: renewals.expired, label: t("tileExpired"), tone: "text-danger", dot: "bg-danger" },
    { key: "expiring", value: renewals.expiring, label: t("tileExpiring"), tone: "text-amber", dot: "bg-amber" },
    { key: "upcoming", value: renewals.upcoming, label: t("tileUpcoming"), tone: "text-ink", dot: "bg-amber/60" },
    { key: "valid", value: renewals.valid, label: t("tileValid"), tone: "text-accent", dot: "bg-accent" },
  ];

  return (
    <Reveal className="lg:col-span-12">
      <section className="rounded-[1.5rem] border border-line bg-surface p-6 shadow-[0_18px_44px_rgba(16,42,51,.06)] sm:p-7" aria-labelledby="radar-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-amber">{t("radarEyebrow")}</p>
            <h2 id="radar-title" className="mt-2 text-lg font-semibold tracking-[-0.03em]">
              {t("radarTitle")}
            </h2>
          </div>
          <Link
            href="/renewals"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-semibold transition-colors hover:border-accent hover:text-accent"
          >
            <Hourglass className="h-3.5 w-3.5" /> {t("openTracker")}
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((tile) => (
              <Link
                key={tile.key}
                href={{ pathname: "/renewals", query: { status: tile.key } }}
                className="group rounded-2xl border border-line bg-surface-soft p-4 transition-all hover:-translate-y-0.5 hover:border-accent"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                  <span className={`h-2 w-2 rounded-full ${tile.dot}`} /> {tile.label}
                </span>
                <span className={`mt-2 block text-3xl font-semibold tracking-[-0.05em] tabular-nums ${tile.value > 0 ? tile.tone : "text-ink-faint"}`}>
                  <CountUp value={tile.value} />
                </span>
              </Link>
            ))}
          </div>

          {next.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
                <RefreshCw className="h-5 w-5" />
              </span>
              <p className="mt-4 font-semibold">{t("radarClear")}</p>
              <p className="mt-1 max-w-xs text-sm text-ink-muted">{t("radarClearHint")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {next.map((item) => {
                const badge = expiryLabel(item.status, item.daysLeft);
                const progress = validityProgress(item.serviceDate, item.expiryDate, today);
                return (
                  <li key={item.id}>
                    <Link href={`/records/${item.id}`} className="group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-soft">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{item.company}</span>
                          <span className="shrink-0 font-mono text-[10px] font-bold text-ink-muted">{shortCategoryLabel(label(item.category))}</span>
                        </span>
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line">
                          <span className={`block h-full rounded-full ${EXPIRY_STATUS_STYLES[item.status].bar}`} style={{ width: `${Math.max(3, progress * 100)}%` }} />
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right text-xs tabular-nums text-ink-muted sm:block">{formatServiceDate(item.expiryDate, intlLocale)}</span>
                      <ExpiryBadge status={item.status} label={t(badge.key as Parameters<typeof t>[0], badge.values)} className="shrink-0" />
                      <Arrow className="h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </Reveal>
  );
}
