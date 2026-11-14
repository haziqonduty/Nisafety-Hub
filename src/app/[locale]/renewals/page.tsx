import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/app/_components/brand-logo";
import { CountUp } from "@/app/_components/count-up";
import { AlertTriangle, Bell, Check, Hourglass } from "@/app/_components/icons";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { RenewalsTracker, type TrackerFilter } from "@/app/_components/renewals-tracker";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link } from "@/i18n/routing";
import { getRenewals } from "@/lib/supabase/queries";
import { CATEGORY_GROUPS } from "@/lib/format";
import { VALIDITY_RULES } from "@/lib/validity";

export const dynamic = "force-dynamic";

const FILTERS: TrackerFilter[] = ["all", "expired", "expiring", "upcoming", "valid"];

export default async function RenewalsPage(props: PageProps<"/[locale]/renewals">) {
  const searchParams = await props.searchParams;
  const requested = typeof searchParams.status === "string" ? searchParams.status : "all";
  const initialFilter = (FILTERS as string[]).includes(requested) ? (requested as TrackerFilter) : "all";

  const [renewals, t, tNav, tCategories, tGroups] = await Promise.all([
    getRenewals(),
    getTranslations("expiry"),
    getTranslations("nav"),
    getTranslations("categories.items"),
    getTranslations("categories.groups"),
  ]);

  const tiles = [
    { key: "expired", value: renewals.expired, label: t("tileExpired"), icon: AlertTriangle, tone: "text-danger bg-danger-soft" },
    { key: "expiring", value: renewals.expiring, label: t("tileExpiring"), icon: Bell, tone: "text-amber bg-amber-soft" },
    { key: "upcoming", value: renewals.upcoming, label: t("tileUpcoming"), icon: Hourglass, tone: "text-ink bg-badge-neutral-bg" },
    { key: "valid", value: renewals.valid, label: t("tileValid"), icon: Check, tone: "text-accent bg-accent-soft" },
  ];

  function label(category: string) {
    try {
      return tCategories(category);
    } catch {
      return category;
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] overflow-hidden" aria-hidden="true">
        <div className="absolute -top-48 right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-amber-soft/70 blur-3xl" />
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-6 lg:px-8">
        <BrandLogo />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/" className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover">
            ← {tNav("workspace")}
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-6 lg:px-8">
        <div className="animate-[rise_.6s_ease-out_both]">
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-amber">{t("trackerEyebrow")}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{t("trackerTitle")}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted">{t("trackerSubtitle")}</p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((tile, index) => (
            <Link
              key={tile.key}
              href={{ pathname: "/renewals", query: { status: tile.key } }}
              scroll={false}
              style={{ animationDelay: `${index * 60}ms` }}
              className="group rounded-[1.5rem] border border-line bg-surface p-5 shadow-[0_18px_44px_rgba(16,42,51,.06)] transition-all animate-[rise_.6s_ease-out_both] hover:-translate-y-0.5 hover:border-accent sm:p-6"
            >
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tile.tone}`}>
                <tile.icon className="h-5 w-5" />
              </span>
              <span className="mt-5 block text-4xl font-semibold tracking-[-0.06em] tabular-nums">
                <CountUp value={tile.value} />
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{tile.label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          {/* Remount when the filter in the URL changes (tile clicks) so it's applied. */}
          <RenewalsTracker key={initialFilter} items={renewals.items} initialFilter={initialFilter} />
        </div>

        <details className="group mt-14 rounded-[1.5rem] border border-line bg-surface p-6 sm:p-7">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <span>
              <span className="block font-mono text-[11px] font-semibold tracking-[0.14em] text-accent">{t("rulesEyebrow")}</span>
              <span className="mt-1 block text-lg font-semibold tracking-[-0.03em]">{t("rulesTitle")}</span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-muted">{t("rulesIntro")}</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.group}>
                <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{tGroups(group.group)}</p>
                <ul className="mt-3 divide-y divide-line">
                  {group.categories.map((category) => {
                    const rule = VALIDITY_RULES[category];
                    return (
                      <li key={category} className="flex items-start justify-between gap-4 py-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{label(category)}</span>
                          <span className="mt-0.5 block text-xs text-ink-muted">{rule?.basis}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-mono text-xs font-bold tabular-nums">{rule?.months ? t("monthsShort", { months: rule.months }) : "—"}</span>
                          {rule && (
                            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold ${rule.confidence === "regulation" ? "bg-accent-soft text-accent" : "bg-badge-neutral-bg text-badge-neutral-text"}`}>
                              {rule.confidence === "regulation" ? t("statutory") : t("typical")}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}
