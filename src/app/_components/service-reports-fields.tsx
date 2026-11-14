"use client";

import { useTranslations } from "next-intl";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { Calendar, Check, Close, File, Hourglass, Plus, Upload } from "@/app/_components/icons";
import { compressPdf } from "@/lib/compress-pdf";
import { CATEGORY_GROUPS, formatServiceDate, todayInMalaysia } from "@/lib/format";
import { generatePdfThumbnail } from "@/lib/generate-pdf-thumbnail";
import { addDays, addMonths, defaultExpiryFor, validityRuleFor } from "@/lib/validity";

// Matches the server's MAX_FILE_SIZE (src/lib/document-upload.ts) — driven
// by Vercel's hard 4.5MB request-body limit.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
export const MAX_SERVICES_PER_VISIT = 8;

export type ServiceRowStatus = "idle" | "uploading" | "done" | "error";

/**
 * "auto": expiry follows the category's validity period from the service
 * date (and moves when either changes); "custom": staff typed a date (e.g.
 * the assessor's recommended next monitoring); "none": no fixed expiry.
 */
export type ExpiryMode = "auto" | "custom" | "none";

export type ServiceRow = {
  key: string;
  category: string;
  expiryMode: ExpiryMode;
  customExpiry: string;
  file: File | null;
  compressing: boolean;
  notice: string;
  status: ServiceRowStatus;
  /** Translation key under `submissionErrors`. */
  errorCode: string;
};

export function newServiceRow(): ServiceRow {
  return { key: crypto.randomUUID(), category: "", expiryMode: "auto", customExpiry: "", file: null, compressing: false, notice: "", status: "idle", errorCode: "" };
}

const KNOWN_ERROR_CODES = new Set([
  "INVALID_CATEGORY",
  "INVALID_SERVICE_DATE",
  "INVALID_EXPIRY_DATE",
  "INVALID_FILE_TYPE",
  "FILE_SIZE",
  "UPLOAD_ERROR",
  "DOCUMENT_SAVE_ERROR",
  "FILE_TOO_LARGE_AFTER_COMPRESSION",
  "FILE_TYPE_CANNOT_COMPRESS",
  "NOT_FOUND",
  "NETWORK_ERROR",
  "noFile",
]);

export function knownErrorCode(code: string | undefined) {
  return code && KNOWN_ERROR_CODES.has(code) ? code : "GENERIC";
}

/** The expiry this row will be saved with ("" = no fixed expiry). */
export function effectiveExpiry(row: ServiceRow, serviceDate: string) {
  if (row.expiryMode === "none") return "";
  if (row.expiryMode === "custom") return row.customExpiry;
  return defaultExpiryFor(row.category, serviceDate) ?? "";
}

/** Appends one service's category, dates, file and (for PDFs) a thumbnail. */
export async function appendServiceReport(formData: FormData, row: ServiceRow, serviceDate: string) {
  formData.append("category", row.category);
  formData.append("serviceDate", serviceDate);
  // Always sent, so the server stores exactly what the row showed.
  formData.append("expiryDate", effectiveExpiry(row, serviceDate));
  if (!row.file) return;
  formData.append("file", row.file);
  if (row.file.type === "application/pdf") {
    const thumbnail = await generatePdfThumbnail(row.file).catch(() => null);
    if (thumbnail) formData.append("thumbnail", thumbnail);
  }
}

function patchRow(setRows: Dispatch<SetStateAction<ServiceRow[]>>, key: string, patch: Partial<ServiceRow>) {
  setRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
}

/**
 * Uploads every not-yet-saved row to an existing client, one request each
 * (Vercel caps a request body at 4.5MB, so reports can't travel together),
 * marking each row's status as it goes. Rows already `done` are skipped, so
 * calling this again after a partial failure retries only what failed.
 * Returns whether every row is now saved.
 */
export async function uploadServiceRows(clientId: string, rows: ServiceRow[], serviceDate: string, setRows: Dispatch<SetStateAction<ServiceRow[]>>) {
  let allSaved = true;
  for (const row of rows) {
    if (row.status === "done") continue;
    patchRow(setRows, row.key, { status: "uploading", errorCode: "" });
    try {
      const formData = new FormData();
      await appendServiceReport(formData, row, serviceDate);
      const response = await fetch(`/api/clients/${clientId}/reports`, { method: "POST", body: formData });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) {
        patchRow(setRows, row.key, { status: "done" });
      } else {
        allSaved = false;
        patchRow(setRows, row.key, { status: "error", errorCode: knownErrorCode(result.error) });
      }
    } catch {
      allSaved = false;
      patchRow(setRows, row.key, { status: "error", errorCode: "NETWORK_ERROR" });
    }
  }
  return allSaved;
}

/** Client-side check before anything is sent; marks offending rows. */
export function validateServiceRows(rows: ServiceRow[], setRows: Dispatch<SetStateAction<ServiceRow[]>>, serviceDate: string) {
  const problems = new Map<string, string>();
  for (const row of rows) {
    if (row.status === "done") continue;
    if (!row.category) problems.set(row.key, "INVALID_CATEGORY");
    else if (row.expiryMode === "custom" && (!row.customExpiry || row.customExpiry <= serviceDate)) problems.set(row.key, "INVALID_EXPIRY_DATE");
    else if (!row.file) problems.set(row.key, "noFile");
  }
  if (problems.size > 0) {
    setRows((current) => current.map((row) => (problems.has(row.key) ? { ...row, status: "error", errorCode: problems.get(row.key)! } : row)));
  }
  return problems.size === 0;
}

const fieldClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-60";

type Props = {
  serviceDate: string;
  onServiceDateChange: (value: string) => void;
  rows: ServiceRow[];
  setRows: Dispatch<SetStateAction<ServiceRow[]>>;
  /** Locks the date and every saved/uploading row (e.g. mid-upload, or after a partial save). */
  locked?: boolean;
};

export function ServiceReportsFields({ serviceDate, onServiceDateChange, rows, setRows, locked = false }: Props) {
  const t = useTranslations("services");
  const tSubmit = useTranslations("submit");
  const tErrors = useTranslations("submissionErrors");
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");
  const tExpiry = useTranslations("expiry");
  const today = todayInMalaysia();
  const chosenCategories = rows.map((row) => row.category).filter(Boolean);

  async function chooseFile(row: ServiceRow, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    patchRow(setRows, row.key, { notice: "", status: "idle", errorCode: "" });

    if (!file || file.size <= MAX_FILE_SIZE) {
      patchRow(setRows, row.key, { file });
      return;
    }
    if (file.type !== "application/pdf") {
      event.target.value = "";
      patchRow(setRows, row.key, { file: null, status: "error", errorCode: "FILE_TYPE_CANNOT_COMPRESS" });
      return;
    }

    patchRow(setRows, row.key, { file: null, compressing: true });
    try {
      const result = await compressPdf(file, MAX_FILE_SIZE);
      if (!result.ok) {
        event.target.value = "";
        patchRow(setRows, row.key, { status: "error", errorCode: "FILE_TOO_LARGE_AFTER_COMPRESSION" });
        return;
      }
      patchRow(setRows, row.key, {
        file: result.file,
        notice: tSubmit("compressedNotice", {
          originalSize: `${(result.originalSize / (1024 * 1024)).toFixed(1)} MB`,
          newSize: `${(result.compressedSize / (1024 * 1024)).toFixed(1)} MB`,
        }),
      });
    } finally {
      patchRow(setRows, row.key, { compressing: false });
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-line bg-surface-soft p-4 sm:p-5">
        <label htmlFor="service-date" className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-accent" /> {t("monitoringDate")}
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="service-date"
            type="date"
            required
            min="2000-01-01"
            max={today}
            value={serviceDate}
            disabled={locked}
            onChange={(event) => onServiceDateChange(event.target.value)}
            className={`${fieldClass} max-w-[13rem] font-medium tabular-nums`}
          />
          {serviceDate === today && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide text-accent">{t("today")}</span>}
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-muted">{t("serviceDateHint")}</p>
      </div>

      <ol className="mt-5 space-y-3">
        {rows.map((row, index) => {
          const rowLocked = locked || row.status === "uploading" || row.status === "done";
          const duplicate = row.category && chosenCategories.filter((value) => value === row.category).length > 1;
          return (
            <li
              key={row.key}
              className={`rounded-2xl border p-4 transition-colors sm:p-5 animate-[rise_.3s_ease-out_both] ${
                row.status === "done" ? "border-accent/40 bg-accent-soft/40" : row.status === "error" ? "border-danger/40 bg-danger-soft/40" : "border-line bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-muted">{t("serviceNumber", { number: String(index + 1).padStart(2, "0") })}</span>
                <span className="flex items-center gap-2">
                  {row.status === "uploading" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" /> {t("uploading")}
                    </span>
                  )}
                  {row.status === "done" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                      <Check className="h-3.5 w-3.5" /> {t("saved")}
                    </span>
                  )}
                  {rows.length > 1 && !rowLocked && (
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                      aria-label={t("removeService", { number: index + 1 })}
                    >
                      <Close className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_.9fr]">
                <select
                  required={row.status !== "done"}
                  value={row.category}
                  disabled={rowLocked}
                  onChange={(event) => patchRow(setRows, row.key, { category: event.target.value, status: "idle", errorCode: "" })}
                  className={fieldClass}
                  aria-label={t("serviceCategory", { number: index + 1 })}
                >
                  <option value="" disabled>
                    {t("selectService")}
                  </option>
                  {CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.group} label={tGroups(group.group)}>
                      {group.categories.map((category) => (
                        <option key={category} value={category}>
                          {tCategories(category)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <label
                  className={`flex min-w-0 items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5 text-sm transition-colors ${
                    rowLocked || row.compressing ? "pointer-events-none" : "cursor-pointer hover:border-accent hover:bg-accent-soft/50"
                  } ${row.file ? "border-accent/50 bg-accent-soft/30" : "border-line bg-surface-soft"}`}
                >
                  <input type="file" accept=".pdf,.doc,.docx" disabled={rowLocked || row.compressing} onChange={(event) => chooseFile(row, event)} className="sr-only" />
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-accent shadow-sm">
                    {row.file ? <File className="h-4 w-4" /> : <Upload className={`h-4 w-4 ${row.compressing ? "animate-pulse" : ""}`} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.compressing ? tSubmit("compressing") : row.file?.name ?? t("chooseReport")}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{row.file ? (row.file.size < 1024 * 1024 ? `${Math.max(1, Math.round(row.file.size / 1024))} KB` : `${(row.file.size / (1024 * 1024)).toFixed(1)} MB`) : t("fileTypes")}</span>
                  </span>
                </label>
              </div>

              {row.category && <ExpiryStrip row={row} serviceDate={serviceDate} locked={rowLocked} onChange={(patch) => patchRow(setRows, row.key, patch)} t={tExpiry} />}

              {row.notice && <p className="mt-2 text-xs text-ink-muted">{row.notice}</p>}
              {duplicate && row.status !== "done" && <p className="mt-2 text-xs text-amber">{t("duplicateService")}</p>}
              {row.status === "error" && (
                <p className="mt-2 text-xs font-medium text-danger" role="alert">
                  {tErrors(row.errorCode as Parameters<typeof tErrors>[0])}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!locked && rows.length < MAX_SERVICES_PER_VISIT && (
        <button
          type="button"
          onClick={() => setRows((current) => [...current, newServiceRow()])}
          className="group mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-4 py-3.5 text-sm font-semibold text-ink-muted transition-colors hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-accent transition-transform group-hover:rotate-90">
            <Plus className="h-3.5 w-3.5" />
          </span>
          {t("addService")}
        </button>
      )}
    </div>
  );
}

type ExpiryTranslator = ReturnType<typeof useTranslations<"expiry">>;

/**
 * The per-service expiry line: shows the auto-calculated expiry with the
 * rule it came from, and lets staff switch to a custom date (e.g. the
 * assessor's recommended next monitoring) or "no fixed expiry".
 */
function ExpiryStrip({
  row,
  serviceDate,
  locked,
  onChange,
  t,
}: {
  row: ServiceRow;
  serviceDate: string;
  locked: boolean;
  onChange: (patch: Partial<ServiceRow>) => void;
  t: ExpiryTranslator;
}) {
  const rule = validityRuleFor(row.category);
  const autoExpiry = defaultExpiryFor(row.category, serviceDate);
  const linkClass = "font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-50";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface-soft px-3.5 py-2.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
        <Hourglass className="h-3.5 w-3.5 text-amber" /> {t("validUntil")}
      </span>

      {row.expiryMode === "custom" ? (
        <>
          <input
            type="date"
            required
            disabled={locked}
            min={serviceDate ? addDays(serviceDate, 1) : undefined}
            value={row.customExpiry}
            onChange={(event) => onChange({ customExpiry: event.target.value, status: "idle", errorCode: "" })}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            aria-label={t("customExpiryLabel")}
          />
          {!locked && (
            <button type="button" className={linkClass} onClick={() => onChange({ expiryMode: "auto" })}>
              {t("useDefault")}
            </button>
          )}
        </>
      ) : row.expiryMode === "none" || !autoExpiry ? (
        <>
          <span className="text-ink-muted">{row.expiryMode === "none" ? t("noExpiry") : t("noFixedInterval")}</span>
          {!locked && (
            <button type="button" className={linkClass} onClick={() => onChange({ expiryMode: "custom", customExpiry: row.customExpiry || (serviceDate ? addMonths(serviceDate, 12) : "") })}>
              {t("setDate")}
            </button>
          )}
          {!locked && row.expiryMode === "none" && autoExpiry && (
            <button type="button" className={linkClass} onClick={() => onChange({ expiryMode: "auto" })}>
              {t("useDefault")}
            </button>
          )}
        </>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-ink">{formatServiceDate(autoExpiry)}</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-bold text-accent">{t("autoMonths", { months: rule!.months! })}</span>
          {!locked && (
            <>
              <button type="button" className={linkClass} onClick={() => onChange({ expiryMode: "custom", customExpiry: autoExpiry })}>
                {t("change")}
              </button>
              <button type="button" className="font-semibold text-ink-muted transition-colors hover:text-accent" onClick={() => onChange({ expiryMode: "none" })}>
                {t("noExpiryAction")}
              </button>
            </>
          )}
        </>
      )}

      {rule && <span className="basis-full text-[11px] leading-4 text-ink-faint">{rule.basis}</span>}
    </div>
  );
}
