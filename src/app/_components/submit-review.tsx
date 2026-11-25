"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { AlertTriangle, Calendar, Check, Close, File } from "@/app/_components/icons";
import { effectiveExpiry, type ServiceRow } from "@/app/_components/service-reports-fields";
import { categoryMessageKey, formatServiceDate, todayInMalaysia } from "@/lib/format";
import type { JobDetails } from "@/lib/job-details";

type Duplicate = { category: string; serviceDate: string; fileName: string };

type ReviewInput = {
  /** The client picked or already saved; else the server matches by company name. */
  clientId?: string | null;
  companyName: string;
  rows: ServiceRow[];
  serviceDate: string;
  job: JobDetails;
};

type Review = ReviewInput & { duplicates: Duplicate[] };

function daysBetween(from: string, to: string) {
  const [a, b] = [from, to].map((value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  });
  return Math.round((b - a) / 86_400_000);
}

/**
 * "Review before submitting": every report submission (New Report and Add a
 * service) stops on one summary — company, date of monitoring, each service
 * with its expiry and documents, sales person — and also says when the
 * client already has the same service on the same date. Nothing is uploaded
 * until staff press Confirm. If the duplicate check fails, the review still
 * opens without it, so it never blocks work.
 *
 *   const review = useSubmitReview();
 *   if (!(await review.confirm({ clientId, companyName, rows, serviceDate, job }))) return;
 *   ...
 *   {review.dialog}
 */
export function useSubmitReview() {
  const t = useTranslations("review");
  const tServices = useTranslations("services");
  const tCategories = useTranslations("categories.items");
  const locale = useLocale();
  const dateLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((proceed: boolean) => void) | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  function finish(proceed: boolean) {
    resolver.current?.(proceed);
    resolver.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
  }

  async function confirm(input: ReviewInput) {
    const pending = input.rows.filter((row) => row.status !== "done" && row.category);
    if (pending.length === 0) return true;

    let duplicates: Duplicate[] = [];
    if (input.clientId || input.companyName.trim()) {
      try {
        const response = await fetch("/api/reports/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: input.clientId, companyName: input.companyName, items: pending.map((row) => ({ category: row.category, serviceDate: input.serviceDate })) }),
        });
        if (response.ok) duplicates = ((await response.json()) as { duplicates?: Duplicate[] }).duplicates ?? [];
      } catch {
        // Review without the duplicate check rather than block the submission.
      }
    }

    setReview({ ...input, rows: pending, duplicates });
    dialogRef.current?.showModal();
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }

  const label = (category: string) => (tCategories.has(categoryMessageKey(category)) ? tCategories(categoryMessageKey(category)) : category);

  let content = null;
  if (review) {
    const age = daysBetween(review.serviceDate, todayInMalaysia());
    const ageText = age === 0 ? t("today") : age === 1 ? t("yesterday") : t("daysAgo", { count: age });
    const duplicateCategories = new Set(review.duplicates.map((duplicate) => duplicate.category));

    content = (
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-accent">{t("eyebrow")}</p>
            <h2 id="submit-review-title" className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">
              {review.companyName || t("title")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label={t("close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>

        {review.duplicates.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl border border-amber/40 bg-amber-soft px-3.5 py-3 text-sm text-amber">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {t("duplicateTitle", { count: review.duplicates.length })}
            </p>
            <ul className="mt-1.5 grid gap-0.5 text-xs">
              {review.duplicates.map((duplicate, index) => (
                <li key={`${duplicate.category}-${index}`}>
                  {label(duplicate.category)} · {formatServiceDate(duplicate.serviceDate, dateLocale)} · <span className="break-all">{duplicate.fileName}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-5">{t("duplicateBody")}</p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/40 px-3.5 py-3">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Calendar className="h-4 w-4 text-accent" /> {t("dateLabel")}
            </span>
            <span className="font-semibold tabular-nums">{formatServiceDate(review.serviceDate, dateLocale)}</span>
            <span className="text-xs text-ink-muted">({ageText})</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">{t("dateHint", { count: review.rows.length })}</p>
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-semibold text-ink">{tServices("salesPerson")}:</span> {review.job.salesPerson.trim() || "—"}
          <span className="px-1.5">·</span>
          <span className="font-semibold text-ink">{tServices("maincon")}:</span> {review.job.maincon.trim() || tServices("directJob")}
        </p>

        <ol className="mt-4 grid gap-2">
          {review.rows.map((row, index) => {
            const expiry = effectiveExpiry(row, review.serviceDate);
            const documents = [
              { key: "main", label: row.fileLabel.trim(), fileName: row.file?.name ?? "" },
              ...row.extraFiles.filter((extra) => extra.file).map((extra) => ({ key: extra.key, label: extra.label.trim(), fileName: extra.file!.name })),
            ];
            return (
              <li key={row.key} className={`rounded-xl border px-3.5 py-3 ${duplicateCategories.has(row.category) ? "border-amber/50" : "border-line"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold">
                    <span className="mr-1.5 font-mono text-[10px] text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                    {label(row.category)}
                  </p>
                  <p className="text-xs text-ink-muted">{expiry ? t("validUntil", { date: formatServiceDate(expiry, dateLocale) }) : t("noExpiry")}</p>
                </div>
                <ul className="mt-2 grid gap-1">
                  {documents.map((document) => (
                    <li key={document.key} className="flex min-w-0 items-center gap-2 text-xs">
                      <File className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="shrink-0 font-semibold">{document.label}</span>
                      <span className="min-w-0 truncate text-ink-muted">{document.fileName}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={() => finish(false)} className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink">
            {t("back")}
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(15,118,110,.18)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            <Check className="h-4 w-4" />
            {review.duplicates.length > 0 ? t("confirmAnyway") : t("confirm", { count: review.rows.length })}
          </button>
        </div>
      </div>
    );
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby="submit-review-title"
      onClose={() => finish(false)}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[1.5rem] border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_rgba(16,42,51,.25)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      {content}
    </dialog>
  );

  return { confirm, dialog };
}
