"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AlertTriangle, Calendar, Check, Hourglass } from "@/app/_components/icons";
import { useRouter } from "@/i18n/routing";
import { formatServiceDate, todayInMalaysia } from "@/lib/format";
import { defaultExpiryFor } from "@/lib/validity";

/**
 * Shown on a report whose date of monitoring was filled in automatically
 * (saved before staff had to key it in). Staff enter the real date; the
 * expiry is recalculated from it on the server.
 */
export function ConfirmMonitoringDate({
  id,
  category,
  guessedDate,
  expiryDate,
}: {
  id: string;
  category: string;
  guessedDate: string;
  expiryDate: string | null;
}) {
  const t = useTranslations("confirmDate");
  const tExpiry = useTranslations("expiry");
  const locale = useLocale();
  const intlLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const router = useRouter();
  const [serviceDate, setServiceDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mirrors the server: an expiry that was auto-calculated moves with the date.
  const wasAuto = expiryDate !== null && expiryDate === defaultExpiryFor(category, guessedDate);
  const previewExpiry =
    serviceDate && expiryDate !== null && (wasAuto || expiryDate <= serviceDate) ? defaultExpiryFor(category, serviceDate) : serviceDate ? expiryDate : null;

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceDate) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/records/${id}/service-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceDate }),
      });
      if (!response.ok) {
        setError(t("error"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="relative mt-7 overflow-hidden rounded-[1.5rem] border border-amber/40 bg-gradient-to-br from-amber-soft to-surface to-60% p-5 animate-[rise_.4s_ease-out_both] sm:p-6 print:hidden"
      aria-labelledby="confirm-date-title"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-amber" />
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface text-amber shadow-sm">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-amber">{t("eyebrow")}</p>
          <h2 id="confirm-date-title" className="mt-1 text-lg font-semibold tracking-[-0.03em]">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">{t("body", { date: formatServiceDate(guessedDate, intlLocale) })}</p>
        </div>
      </div>

      <form onSubmit={confirm} className="mt-5 flex flex-wrap items-end gap-3 sm:pl-16">
        <label className="grid gap-1.5 text-xs font-semibold text-ink">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-accent" /> {t("label")}
          </span>
          <input
            type="date"
            required
            min="2000-01-01"
            max={todayInMalaysia()}
            value={serviceDate}
            disabled={saving}
            onChange={(event) => setServiceDate(event.target.value)}
            className="w-[13rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium tabular-nums outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={!serviceDate || saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(16,42,51,.18)] transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {saving ? t("saving") : t("confirm")}
        </button>
        {serviceDate && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted animate-[rise_.3s_ease-out_both]">
            <Hourglass className="h-3.5 w-3.5 text-amber" />
            {previewExpiry ? (
              <>
                {tExpiry("expiresShort")} <span className="font-semibold tabular-nums text-ink">{formatServiceDate(previewExpiry, intlLocale)}</span>
              </>
            ) : (
              tExpiry("noExpiry")
            )}
          </span>
        )}
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger sm:pl-16">
          {error}
        </p>
      )}
    </section>
  );
}
