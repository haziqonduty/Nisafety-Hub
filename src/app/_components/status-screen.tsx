import type { ReactNode } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";

/**
 * Full-page message for "not found" and "something went wrong". These pages
 * render outside the language provider, so the copy is bilingual (English
 * with the Malay underneath) instead of translated.
 */
export function StatusScreen({
  code,
  title,
  titleMs,
  body,
  bodyMs,
  children,
}: {
  code: string;
  title: string;
  titleMs: string;
  body: string;
  bodyMs: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-canvas px-4 py-16 text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft opacity-60 blur-3xl" />
      <section className="relative w-full max-w-lg rounded-[1.75rem] border border-line bg-surface p-8 text-center shadow-[0_30px_80px_rgba(16,42,51,.12)] sm:p-10">
        <div className="flex justify-center">
          <BrandLogo height={36} />
        </div>
        <p className="mt-8 font-mono text-[11px] font-bold tracking-[0.2em] text-accent">{code}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm font-medium text-ink-faint">{titleMs}</p>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-ink-muted">{body}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-faint">{bodyMs}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
      </section>
    </main>
  );
}

export const statusPrimaryButton =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,42,51,.18)] transition hover:-translate-y-0.5 hover:bg-accent-hover";
export const statusSecondaryButton =
  "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-accent hover:text-accent";
