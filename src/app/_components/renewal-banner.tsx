import { getTranslations } from "next-intl/server";
import { ExpiryBadge, expiryLabel } from "@/app/_components/expiry-badge";
import { AlertTriangle, Arrow, Bell } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import { shortCategoryLabel } from "@/lib/format";
import type { RenewalSummary } from "@/lib/supabase/queries";

const MAX_CHIPS = 4;

/**
 * Top-of-workspace alert: shown only when something has expired or expires
 * within 30 days. Red when anything has already expired, amber otherwise.
 */
export async function RenewalBanner({ renewals }: { renewals: RenewalSummary }) {
  const urgent = renewals.items.filter((item) => item.status === "expired" || item.status === "expiring");
  if (urgent.length === 0) return null;

  const [t, tCategories] = await Promise.all([getTranslations("expiry"), getTranslations("categories.items")]);
  const hasExpired = renewals.expired > 0;

  function label(category: string) {
    try {
      return tCategories(category);
    } catch {
      return category;
    }
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden rounded-[1.5rem] border p-4 animate-[rise_.6s_ease-out_both] sm:p-5 ${
        hasExpired ? "border-danger/30 bg-gradient-to-r from-danger-soft via-surface to-surface" : "border-amber/30 bg-gradient-to-r from-amber-soft via-surface to-surface"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-3.5 lg:max-w-md">
          <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-lg ${hasExpired ? "bg-danger" : "bg-amber"}`}>
            <span className={`absolute -inset-1 rounded-[1.1rem] border-2 ${hasExpired ? "border-danger/40" : "border-amber/40"} animate-pulse`} aria-hidden="true" />
            {hasExpired ? <AlertTriangle className="relative h-5 w-5" /> : <Bell className="relative h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold sm:text-base">
              {[
                renewals.expired > 0 ? t("bannerExpired", { count: renewals.expired }) : null,
                renewals.expiring > 0 ? t("bannerExpiring", { count: renewals.expiring }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{t("bannerHint")}</p>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:pb-0">
          {urgent.slice(0, MAX_CHIPS).map((item) => {
            const badge = expiryLabel(item.status, item.daysLeft);
            return (
              <li key={item.id} className="shrink-0">
                <Link
                  href={`/records/${item.id}`}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/90 px-3 py-2 text-xs backdrop-blur transition-all hover:-translate-y-0.5 hover:border-accent"
                >
                  <span className="max-w-[10rem] truncate font-semibold">{item.company}</span>
                  <span className="font-mono text-[10px] font-bold text-ink-muted">{shortCategoryLabel(label(item.category))}</span>
                  <ExpiryBadge status={item.status} label={t(badge.key as Parameters<typeof t>[0], badge.values)} />
                </Link>
              </li>
            );
          })}
          {urgent.length > MAX_CHIPS && (
            <li className="flex shrink-0 items-center px-1 text-xs font-semibold text-ink-muted">{t("andMore", { count: urgent.length - MAX_CHIPS })}</li>
          )}
        </ul>

        <Link
          href="/renewals"
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 ${
            hasExpired ? "bg-danger hover:opacity-90" : "bg-brand hover:bg-brand-hover"
          }`}
        >
          {t("openTracker")} <Arrow className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
