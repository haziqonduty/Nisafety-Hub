"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

/**
 * The root layout's <html lang> is static ("en") because it's shared by
 * both the locale-aware public tree and the locale-less (always-English)
 * admin tree, which can't read the active locale at that level. This syncs
 * the real DOM attribute once a locale is actually known, so Malay pages
 * are correctly announced as Malay to screen readers/browsers instead of
 * staying mislabelled as English.
 */
export function HtmlLangSync() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
