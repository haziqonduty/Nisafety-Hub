import { getLocale, getTranslations } from "next-intl/server";
import { expiryLabel } from "@/app/_components/expiry-badge";
import { AlertTriangle, Arrow, Check, Hourglass, RefreshCw } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import { formatServiceDate, todayInMalaysia } from "@/lib/format";
import type { ServiceHistoryEntry } from "@/lib/supabase/queries";
import { expiryStatus, validityProgress, validityRuleFor } from "@/lib/validity";

const TONE = {
  expired: { ring: "border-danger/40", glow: "from-danger-soft", text: "text-danger", bar: "bg-danger", icon: AlertTriangle },
  expiring: { ring: "border-amber/40", glow: "from-amber-soft", text: "text-amber", bar: "bg-amber", icon: AlertTriangle },
  upcoming: { ring: "border-amber/25", glow: "from-amber-soft/60", text: "text-amber", bar: "bg-accent", icon: Hourglass },
  valid: { ring: "border-accent/30", glow: "from-accent-soft", text: "text-accent", bar: "bg-accent", icon: Check },
  none: { ring: "border-line", glow: "from-surface-soft", text: "text-ink-muted", bar: "bg-line", icon: Hourglass },
  renewed: { ring: "border-line", glow: "from-surface-soft", text: "text-ink-muted", bar: "bg-line", icon: RefreshCw },
} as const;

/**
 * The record page's compliance panel: how long this report stays valid,
 * where today sits in that window, the rule the expiry came from, and a
 * one-click "Renew" that opens Add a service pre-filled with this service.
 */
export async function ValidityCard({
  id,
  category,
  serviceDate,
  expiryDate,
  history,
}: {
  id: string;
  category: string;
  serviceDate: string;
  expiryDate: string | null;
  history: ServiceHistoryEntry[];
}) {
  const [t, locale] = await Promise.all([getTranslations("expiry"), getLocale()]);
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const today = todayInMalaysia();

  // History is newest-first, so the first report of this category is the latest one.
  const latest = history.find((entry) => entry.category === category);
  const superseded = Boolean(latest && latest.id !== id);
  const { status, daysLeft } = expiryStatus(expiryDate, today, superseded);
  const tone = TONE[status];
  const Icon = tone.icon;
  const rule = validityRuleFor(category);
  const label = expiryLabel(status, daysLeft);
  const progress = expiryDate && !superseded ? validityProgress(serviceDate, expiryDate, today) : 0;
  const renewHref = { pathname: `/records/${id}`, query: { renew: category } } as const;

  return (
    <section
      className={`relative mt-7 overflow-hidden rounded-[1.5rem] border bg-gradient-to-br ${tone.glow} to-surface to-60% p-5 sm:p-6 print:hidden ${tone.ring}`}
      aria-labelledby="validity-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface shadow-sm ${tone.text}`}>
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <p id="validity-title" className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-muted">
              {t("complianceValidity")}
            </p>
            <p className={`mt-1 text-2xl font-semibold tracking-[-0.04em] ${status === "valid" || status === "upcoming" ? "text-ink" : tone.text}`}>
              {t(label.key as Parameters<typeof t>[0], label.values)}
            </p>
            {superseded && latest && (
              <p className="mt-1 text-sm text-ink-muted">
                {t("renewedBy", { date: formatServiceDate(latest.serviceDate, intlLocale) })}
              </p>
            )}
            {status === "none" && <p className="mt-1 text-sm text-ink-muted">{t("noExpiryHint")}</p>}
          </div>
        </div>

        {superseded && latest ? (
          <Link
            href={`/records/${latest.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent"
          >
            {t("viewLatest")} <Arrow className="h-4 w-4" />
          </Link>
        ) : status === "expired" || status === "expiring" || status === "upcoming" ? (
          <Link
            href={renewHref}
            scroll={false}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(16,42,51,.18)] transition-all hover:-translate-y-0.5 ${
              status === "expired" ? "bg-danger hover:opacity-90" : "bg-brand hover:bg-brand-hover"
            }`}
          >
            <RefreshCw className="h-4 w-4" /> {t("renewNow")}
          </Link>
        ) : null}
      </div>

      {expiryDate && !superseded && (
        <div className="mt-6">
          <div className="relative h-2 rounded-full bg-line/70">
            <div className={`absolute inset-y-0 left-0 rounded-full ${tone.bar} origin-left animate-[grow-x_.9s_cubic-bezier(.22,1,.36,1)_both]`} style={{ width: `${Math.max(2, progress * 100)}%` }} />
            {progress < 1 && (
              <span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow"
                style={{ left: `${progress * 100}%` }}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("monitoredOn")}</p>
              <p className="mt-1 font-semibold tabular-nums">{formatServiceDate(serviceDate, intlLocale)}</p>
            </div>
            <div className="text-right sm:order-3">
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("expiresOn")}</p>
              <p className={`mt-1 font-semibold tabular-nums ${status === "expired" ? "text-danger" : ""}`}>{formatServiceDate(expiryDate, intlLocale)}</p>
            </div>
            <div className="col-span-2 sm:order-2 sm:col-span-1 sm:text-center">
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("today")}</p>
              <p className="mt-1 font-semibold">{t("percentElapsed", { percent: Math.round(progress * 100) })}</p>
            </div>
          </div>
        </div>
      )}

      {rule && (
        <p className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4 text-xs text-ink-muted">
          <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${rule.confidence === "regulation" ? "bg-accent-soft text-accent" : "bg-badge-neutral-bg text-badge-neutral-text"}`}>
            {rule.confidence === "regulation" ? t("statutory") : t("typical")}
          </span>
          {rule.basis}
        </p>
      )}
    </section>
  );
}
