import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/app/_components/brand-logo";
import { ClientMap } from "@/app/_components/client-map";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link } from "@/i18n/routing";
import { getClientMap } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function ClientMapPage() {
  const [clients, t, tNav] = await Promise.all([getClientMap(), getTranslations("map"), getTranslations("nav")]);

  return (
    <main className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] overflow-hidden" aria-hidden="true">
        <div className="absolute -top-48 right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-accent-soft/70 blur-3xl" />
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

      <section className="relative mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="px-2 animate-[rise_.6s_ease-out_both] sm:px-0">
          <p className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.14em] text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted">{t("subtitle")}</p>
        </div>

        <div className="mt-8 animate-[rise_.7s_ease-out_both] [animation-delay:120ms]">
          <ClientMap initialClients={clients} />
        </div>
      </section>
    </main>
  );
}
