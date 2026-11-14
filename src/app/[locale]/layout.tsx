import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { CommandPalette } from "@/app/_components/command-palette";
import { HtmlLangSync } from "@/app/_components/html-lang-sync";
import { routing } from "@/i18n/routing";
import { getCurrentProfile } from "@/lib/auth/profile";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Cached per request and normally read from the header the proxy already
  // set, so this costs no extra Supabase round trip.
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin" && profile.status === "approved";

  return (
    <NextIntlClientProvider locale={locale}>
      <HtmlLangSync />
      {children}
      <CommandPalette isAdmin={isAdmin} />
    </NextIntlClientProvider>
  );
}
