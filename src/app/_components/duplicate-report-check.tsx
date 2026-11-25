"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Close, Upload } from "@/app/_components/icons";
import type { ServiceRow } from "@/app/_components/service-reports-fields";
import { formatServiceDate } from "@/lib/format";

type Duplicate = { category: string; serviceDate: string; fileName: string };

/**
 * Warns before saving a report the client already has: same service, same
 * service date. Staff choose "Upload anyway" (e.g. a corrected copy) or go
 * back. If the check itself fails, saving carries on — it never blocks work.
 *
 *   const duplicateCheck = useDuplicateReportCheck();
 *   if (!(await duplicateCheck.confirm({ clientId, rows, serviceDate }))) return;
 *   ...
 *   {duplicateCheck.dialog}
 */
export function useDuplicateReportCheck() {
  const t = useTranslations("services");
  const tCategories = useTranslations("categories.items");
  const locale = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((proceed: boolean) => void) | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);

  function finish(proceed: boolean) {
    resolver.current?.(proceed);
    resolver.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
  }

  async function confirm({ clientId, companyName, rows, serviceDate }: { clientId?: string | null; companyName?: string; rows: ServiceRow[]; serviceDate: string }) {
    const items = rows.filter((row) => row.status !== "done" && row.category).map((row) => ({ category: row.category, serviceDate }));
    if (items.length === 0 || (!clientId && !companyName?.trim())) return true;

    let found: Duplicate[] = [];
    try {
      const response = await fetch("/api/reports/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, companyName, items }),
      });
      if (response.ok) found = ((await response.json()) as { duplicates?: Duplicate[] }).duplicates ?? [];
    } catch {
      return true;
    }
    if (found.length === 0) return true;

    setDuplicates(found);
    dialogRef.current?.showModal();
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }

  const label = (category: string) => (tCategories.has(category) ? tCategories(category) : category);

  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby="duplicate-report-title"
      onClose={() => finish(false)}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-[1.5rem] border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_rgba(16,42,51,.25)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-amber">{t("duplicateReportEyebrow")}</p>
            <h2 id="duplicate-report-title" className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">
              {t("duplicateReportTitle", { count: duplicates.length })}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label={t("duplicateReportBack")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-4 grid gap-2">
          {duplicates.map((duplicate, index) => (
            <li key={`${duplicate.category}-${index}`} className="rounded-xl border border-line bg-surface-soft px-3.5 py-2.5 text-sm">
              <p className="font-semibold">{label(duplicate.category)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatServiceDate(duplicate.serviceDate, locale === "ms" ? "ms-MY" : "en-GB")} · <span className="break-all">{duplicate.fileName}</span>
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm text-ink-muted">{t("duplicateReportBody")}</p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => finish(false)} className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink">
            {t("duplicateReportBack")}
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
          >
            <Upload className="h-4 w-4" />
            {t("duplicateReportUploadAnyway")}
          </button>
        </div>
      </div>
    </dialog>
  );

  return { confirm, dialog };
}
