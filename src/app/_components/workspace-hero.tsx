import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CommandPaletteTrigger } from "@/app/_components/command-palette-trigger";
import { ArrowUpRight, Grid, Notes, Search, ShieldCheck, Upload } from "@/app/_components/icons";
import { LiveClock } from "@/app/_components/live-clock";
import { Link } from "@/i18n/routing";
import type { CurrentProfile } from "@/lib/auth/profile";
import type { WorkspaceData } from "@/lib/supabase/queries";

// Staff are all Malaysia-based, so the greeting and the date line are
// computed in Kuala Lumpur time on the server — deterministic HTML, no
// hydration flash. The small live clock next to it is client-side (viewer's
// own timezone) since it has to tick anyway.
const WORKSPACE_TIME_ZONE = "Asia/Kuala_Lumpur";

function greetingKey(hour: number) {
  if (hour < 12) return "goodMorning" as const;
  if (hour < 18) return "goodAfternoon" as const;
  return "goodEvening" as const;
}

const ACTION_TILE =
  "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-300/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/30";

export async function WorkspaceHero({ profile, data, renewalAlerts }: { profile: CurrentProfile; data: WorkspaceData; renewalAlerts: number }) {
  const [t, locale] = await Promise.all([getTranslations("workspace"), getLocale()]);
  const now = new Date();
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: WORKSPACE_TIME_ZONE }).format(now)) % 24;
  const dateLine = new Intl.DateTimeFormat(intlLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: WORKSPACE_TIME_ZONE }).format(now);
  const firstName = profile.fullName.trim().split(/\s+/)[0] || profile.fullName;
  const isAdmin = profile.role === "admin";
  const attention = data.myIncompleteCount + (data.pendingApprovals?.count ?? 0) + renewalAlerts;

  return (
    <section
      id="top"
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1416] text-white shadow-[0_40px_90px_rgba(16,42,51,.28)] animate-[rise_.7s_.05s_ease-out_both]"
    >
      {/* Atmosphere: slow aurora + a faint dot grid, both purely decorative. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-teal-400/25 blur-3xl animate-[aurora_18s_ease-in-out_infinite]" />
        <div className="absolute -right-24 top-10 h-[26rem] w-[26rem] rounded-full bg-cyan-300/15 blur-3xl animate-[aurora_24s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[22rem] w-[22rem] rounded-full bg-amber-300/10 blur-3xl animate-[aurora_30s_ease-in-out_infinite]" />
        <div
          className="absolute inset-0 opacity-[0.18] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.55) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />
      </div>

      <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:p-12">
        <div className="flex flex-col justify-between gap-10">
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-white/60">
              <span className="inline-flex items-center gap-2 text-teal-300">
                <span className="relative grid h-2 w-2 place-items-center">
                  <span className="absolute inset-0 rounded-full bg-teal-300 animate-[ping-soft_1.8s_ease-out_infinite]" />
                  <span className="relative h-2 w-2 rounded-full bg-teal-300" />
                </span>
                {t("live")}
              </span>
              <span className="hidden h-3 w-px bg-white/15 sm:block" />
              <LiveClock locale={locale} className="text-white/80" />
              <span className="hidden h-3 w-px bg-white/15 sm:block" />
              <span className="normal-case tracking-normal text-white/60">{dateLine}</span>
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-5xl lg:text-6xl">
              {t(greetingKey(hour))},{" "}
              <span className="bg-gradient-to-r from-teal-200 via-teal-300 to-cyan-200 bg-clip-text text-transparent">{firstName}</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
              {t("summary", { thisWeek: data.thisWeekDocuments, totalDocuments: data.totalDocuments, totalClients: data.totalClients })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
              {isAdmin ? t("roleAdmin") : t("roleStaff")}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                attention > 0 ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-white/15 bg-white/5 text-white/80"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${attention > 0 ? "bg-amber-300" : "bg-teal-300"}`} />
              {attention > 0 ? t("attentionChip", { count: attention }) : t("allClearChip")}
            </span>
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-white/50">{t("quickActions")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/submit" className={`${ACTION_TILE} flex-row items-center gap-4 border-teal-300/30 bg-teal-400/15 hover:bg-teal-400/25 sm:col-span-2`}>
              <span className="flex min-w-0 items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-400 text-slate-950 shadow-[0_10px_24px_rgba(45,212,191,.35)]">
                  <Upload className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold">{t("newReport")}</span>
                  <span className="mt-0.5 block text-sm text-white/60">{t("newReportHint")}</span>
                </span>
              </span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-teal-200 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>

            <CommandPaletteTrigger className={ACTION_TILE} ariaLabel={t("findRecord")}>
              <span className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-teal-200">
                  <Search className="h-4.5 w-4.5" />
                </span>
                <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60">⌘ K</kbd>
              </span>
              <span className="mt-6 block">
                <span className="block text-sm font-semibold">{t("findRecord")}</span>
                <span className="mt-0.5 block text-xs text-white/55">{t("findRecordHint")}</span>
              </span>
            </CommandPaletteTrigger>

            {isAdmin ? (
              <NextLink href="/admin" className={ACTION_TILE}>
                <span className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-teal-200">
                    <Grid className="h-4.5 w-4.5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/40 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal-200" />
                </span>
                <span className="mt-6 block">
                  <span className="block text-sm font-semibold">{t("adminDashboard")}</span>
                  <span className="mt-0.5 block text-xs text-white/55">{t("adminDashboardHint")}</span>
                </span>
              </NextLink>
            ) : (
              <a href="#mine" className={ACTION_TILE}>
                <span className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-teal-200">
                    <Notes className="h-4.5 w-4.5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/40 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal-200" />
                </span>
                <span className="mt-6 block">
                  <span className="block text-sm font-semibold">{t("myRecords")}</span>
                  <span className="mt-0.5 block text-xs text-white/55">{t("myRecordsHint")}</span>
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
