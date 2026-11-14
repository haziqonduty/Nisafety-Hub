import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/app/_components/brand-logo";
import { DirectoryExplorer } from "@/app/_components/directory-explorer";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { LogoutButton } from "@/app/_components/logout-button";
import { RealtimeDirectoryBanner } from "@/app/_components/realtime-directory-banner";
import { RenewalBanner } from "@/app/_components/renewal-banner";
import { RenewalsRadar } from "@/app/_components/renewals-radar";
import { Reveal } from "@/app/_components/reveal";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { WorkspaceBento } from "@/app/_components/workspace-bento";
import { WorkspaceHero } from "@/app/_components/workspace-hero";
import { Link } from "@/i18n/routing";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getDirectoryDocuments, getRenewals, getWorkspaceData } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Middleware already guarantees a signed-in, approved profile here; the
  // fallback only exists so the page can't crash if that invariant ever slips.
  const profile = (await getCurrentProfile()) ?? { id: "", email: "", fullName: "there", role: "staff" as const, status: "approved" as const };
  const [documents, workspace, renewals, t, tNav] = await Promise.all([
    getDirectoryDocuments(),
    getWorkspaceData(profile),
    getRenewals(),
    getTranslations("home"),
    getTranslations("nav"),
  ]);
  const isAdmin = profile.role === "admin";
  const renewalAlerts = renewals.expired + renewals.expiring;

  return (
    <main className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <RealtimeDirectoryBanner />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] overflow-hidden animate-[fade-in_1.2s_ease-out_both]" aria-hidden="true">
        <div className="absolute -top-52 right-[-8rem] h-[31rem] w-[31rem] rounded-full bg-accent-soft/55 blur-3xl" />
        <div className="absolute -left-20 top-40 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-6 animate-[fade-down_.6s_ease-out_both] lg:px-8">
        <BrandLogo />
        <nav className="hidden items-center gap-1 rounded-full border border-line bg-surface/80 p-1 text-sm font-medium text-ink-muted backdrop-blur md:flex" aria-label="Primary navigation">
          <a href="#top" className="rounded-full bg-brand px-3.5 py-1.5 text-white">{tNav("workspace")}</a>
          <a href="#directory" className="rounded-full px-3.5 py-1.5 transition-colors hover:text-accent">{tNav("directory")}</a>
          <Link href="/renewals" className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors hover:text-accent">
            {tNav("renewals")}
            {renewalAlerts > 0 && (
              <span className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${renewals.expired > 0 ? "bg-danger" : "bg-amber"}`}>{renewalAlerts}</span>
            )}
          </Link>
          <Link href="/submit" className="rounded-full px-3.5 py-1.5 transition-colors hover:text-accent">{tNav("submit")}</Link>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          {isAdmin && (
            <NextLink href="/admin" className="hidden rounded-full border border-line bg-surface/70 px-4 py-2 text-sm font-medium transition-all duration-200 hover:border-accent hover:bg-surface hover:text-accent sm:inline-block">
              {tNav("adminDashboard")}
            </NextLink>
          )}
          <LogoutButton />
        </div>
      </header>

      {renewalAlerts > 0 && (
        <div className="relative mx-auto max-w-7xl px-6 pb-4 lg:px-8">
          <RenewalBanner renewals={renewals} />
        </div>
      )}

      <div className="relative mx-auto max-w-7xl px-6 pt-2 lg:px-8">
        <WorkspaceHero profile={profile} data={workspace} renewalAlerts={renewalAlerts} />
      </div>

      <section className="relative mx-auto max-w-7xl px-6 pt-5 lg:px-8">
        <WorkspaceBento data={workspace} isAdmin={isAdmin} renewalAlerts={renewalAlerts} />
        <div className="mt-5 grid lg:grid-cols-12">
          <RenewalsRadar renewals={renewals} />
        </div>
      </section>

      <section id="directory" className="relative mx-auto max-w-7xl scroll-mt-24 px-6 pb-24 pt-20 lg:px-8 lg:pt-24">
        <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">{t("directoryEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{t("directoryTitle")}</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-ink-muted">{t("directoryParagraph")}</p>
        </Reveal>
        <DirectoryExplorer documents={documents} />
      </section>

      <footer className="border-t border-line bg-surface px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLogo height={24} />
            <p className="mt-2">{t("footerTagline")}</p>
            <p className="mt-1 text-xs text-ink-faint">{t("credit")}</p>
          </div>
          <a href="#top" className="font-semibold text-accent hover:text-accent-hover">{t("backToTop")}</a>
        </div>
      </footer>
    </main>
  );
}
