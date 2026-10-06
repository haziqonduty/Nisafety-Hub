import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Upload } from "@/app/_components/icons";
import { BrandLogo } from "@/app/_components/brand-logo";
import { DirectoryExplorer } from "@/app/_components/directory-explorer";
import { DirectoryPreview } from "@/app/_components/directory-preview";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { MagneticLink } from "@/app/_components/magnetic-link";
import { RealtimeDirectoryBanner } from "@/app/_components/realtime-directory-banner";
import { Reveal } from "@/app/_components/reveal";
import { SpotlightCard } from "@/app/_components/spotlight-card";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link } from "@/i18n/routing";
import { getDirectoryDocuments } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [documents, t] = await Promise.all([getDirectoryDocuments(), getTranslations("home")]);
  const tNav = await getTranslations("nav");

  const steps = [
    ["01", t("step1Title"), t("step1Copy")],
    ["02", t("step2Title"), t("step2Copy")],
    ["03", t("step3Title"), t("step3Copy")],
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-ink">
      <RealtimeDirectoryBanner />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] overflow-hidden animate-[fade-in_1.2s_ease-out_both]" aria-hidden="true">
        <div className="absolute -top-52 right-[-8rem] h-[31rem] w-[31rem] rounded-full bg-accent-soft/55 blur-3xl" />
        <div className="absolute top-16 right-[18%] h-48 w-48 rounded-full border border-accent-soft/45" />
        <div className="absolute -left-20 top-64 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
      </div>
      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 animate-[fade-down_.6s_ease-out_both] lg:px-8">
        <BrandLogo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-muted md:flex" aria-label="Primary navigation">
          <a href="#explore" className="transition-colors hover:text-accent">{tNav("explore")}</a>
          <a href="#how-it-works" className="transition-colors hover:text-accent">{tNav("howItWorks")}</a>
          <a href="#submit" className="transition-colors hover:text-accent">{tNav("submit")}</a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <NextLink href="/admin/login" className="rounded-full border border-line bg-surface/70 px-4 py-2 text-sm font-medium transition-all duration-200 hover:border-accent hover:bg-surface hover:text-accent">{tNav("adminSignIn")}</NextLink>
        </div>
      </header>

      <section id="top" className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-32 lg:pt-24">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex animate-[rise_.6s_.05s_ease-out_both] items-center gap-2 rounded-full border border-accent-soft bg-accent-soft px-3 py-1.5 text-xs font-semibold tracking-wide text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />{t("heroBadge")}
          </div>
          <h1 className="max-w-2xl animate-[rise_.6s_.14s_ease-out_both] text-5xl font-semibold leading-[1.03] tracking-[-0.065em] text-ink sm:text-6xl lg:text-7xl">
            {t("heroTitleLine1")}<br /><span className="text-accent">{t("heroTitleAccent")}</span> {t("heroTitleLine2")}
          </h1>
          <p className="mt-7 max-w-xl animate-[rise_.6s_.22s_ease-out_both] text-lg leading-8 text-ink-muted">{t("heroParagraph")}</p>
          <div className="mt-9 flex animate-[rise_.6s_.3s_ease-out_both] flex-col gap-3 sm:flex-row">
            <MagneticLink>
              <a href="#explore" className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,42,51,.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-hover">
                {t("exploreDocuments")} <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </MagneticLink>
            <MagneticLink>
              <a href="#submit" className="group inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface/70 px-5 py-3.5 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-surface hover:text-accent">
                <Upload className="h-4 w-4" /> {t("submitRecord")}
              </a>
            </MagneticLink>
          </div>
        </div>
        <DirectoryPreview documents={documents} totalCount={documents.length} />
      </section>

      <section id="explore" className="relative border-y border-line bg-surface/60 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <Reveal className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">{t("exploreEyebrow")}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{t("exploreTitle")}</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-ink-muted">{t("exploreParagraph")}</p>
          </Reveal>
          <DirectoryExplorer documents={documents} />
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">{t("howItWorksEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{t("howItWorksTitle")}</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-ink-muted">{t("howItWorksParagraph")}</p>
          </Reveal>
          <Reveal delay={0.15}>
            <ol className="grid gap-4 sm:grid-cols-3">
              {steps.map(([number, title, copy]) => (
                <SpotlightCard as="li" key={number} className="rounded-2xl border border-line bg-surface p-5 transition-transform duration-300 hover:-translate-y-1">
                  <span className="font-mono text-xs font-semibold text-accent">{number}</span>
                  <h3 className="mt-8 text-lg font-semibold tracking-[-0.03em]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{copy}</p>
                </SpotlightCard>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section id="submit" className="mx-auto max-w-7xl px-6 pb-24 lg:px-8 lg:pb-32">
        <Reveal className="relative overflow-hidden rounded-[1.75rem] bg-brand px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:py-16">
          <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full border border-on-brand-accent opacity-50" />
          <div className="pointer-events-none absolute right-20 top-8 h-40 w-40 rounded-full bg-on-brand-accent opacity-25 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-on-brand-accent">{t("ctaEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{t("ctaTitle")}</h2>
            <p className="mt-4 text-sm leading-7 text-on-brand-muted">{t("ctaParagraph")}</p>
          </div>
          <MagneticLink>
            <Link href="/submit" className="relative mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-on-brand px-5 py-3.5 text-sm font-semibold text-on-brand-text transition-all duration-200 hover:-translate-y-0.5 hover:bg-white lg:mt-0">
              {t("ctaButton")} <ArrowUpRight className="h-4 w-4" />
            </Link>
          </MagneticLink>
        </Reveal>
      </section>

      <footer className="border-t border-line bg-surface px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo height={24} />
          <p>{t("footerTagline")}</p>
          <a href="#top" className="font-semibold text-accent hover:text-accent-hover">{t("backToTop")}</a>
        </div>
      </footer>
    </main>
  );
}
