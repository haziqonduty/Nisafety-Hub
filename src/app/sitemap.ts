import type { MetadataRoute } from "next";
import { getPathname, routing } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nisafetyhub.com";

// Intentionally just the two static, always-public pages — individual
// client/document record pages stay reachable by direct link and the
// site's own search, but aren't promoted to search engines for indexing.
const PATHS = ["/", "/submit"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: `${SITE_URL}${getPathname({ href: path, locale: routing.defaultLocale })}`,
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1 : 0.8,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${SITE_URL}${getPathname({ href: path, locale })}`]),
      ),
    },
  }));
}
