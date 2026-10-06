import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { CommandPalette } from "@/app/_components/command-palette";
import { HtmlLangSync } from "@/app/_components/html-lang-sync";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <NextIntlClientProvider locale={locale}>
      <HtmlLangSync />
      {children}
      <CommandPalette />
    </NextIntlClientProvider>
  );
}
