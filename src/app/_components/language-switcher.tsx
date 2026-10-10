"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ms", label: "BM" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center rounded-full border border-line bg-surface p-0.5 text-xs font-semibold">
      {LOCALES.map((option) => (
        <button
          key={option.code}
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => router.replace(pathname, { locale: option.code }))}
          aria-current={locale === option.code}
          className={`rounded-full px-2.5 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            locale === option.code ? "bg-brand text-white" : "text-ink-muted hover:text-accent"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
