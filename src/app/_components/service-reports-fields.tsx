"use client";

import { useTranslations } from "next-intl";
import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, Calendar, Check, Close, File, Hourglass, Plus, Upload } from "@/app/_components/icons";
import { compressPdf } from "@/lib/compress-pdf";
import { appendUploadedFile, MAX_UPLOAD_SIZE, uploadReportFile } from "@/lib/direct-upload";
import { CATEGORY_GROUPS, categoryMessageKey, formatServiceDate, todayInMalaysia } from "@/lib/format";
import { generatePdfThumbnail } from "@/lib/generate-pdf-thumbnail";
import { appendJobDetails, MAX_MAINCON_LENGTH, MAX_SALES_PERSON_LENGTH, type JobDetails } from "@/lib/job-details";
import { MAX_EXTRA_FILES, MAX_FILE_LABEL_LENGTH } from "@/lib/report-files";
import { addDays, addMonths, defaultExpiryFor, validityRuleFor } from "@/lib/validity";

// Reports upload straight to Supabase Storage (src/lib/direct-upload.ts),
// so the only limit is Storage's 50 MB per file; only PDFs above that are
// compressed.
const MAX_FILE_SIZE = MAX_UPLOAD_SIZE;
export const MAX_SERVICES_PER_VISIT = 8;

export type ServiceRowStatus = "idle" | "uploading" | "done" | "error";

/**
 * "auto": expiry follows the category's validity period from the service
 * date (and moves when either changes); "custom": staff typed a date (e.g.
 * the assessor's recommended next monitoring); "none": no fixed expiry.
 */
export type ExpiryMode = "auto" | "custom" | "none";

/** Another document of the same service report, with its own name/remark. */
export type ExtraFile = { key: string; file: File | null; label: string };

export type ServiceRow = {
  key: string;
  category: string;
  /** Date of monitoring of THIS service (YYYY-MM-DD); every service has its own. */
  serviceDate: string;
  /** Sales person / maincon of this service's job. */
  salesPerson: string;
  maincon: string;
  expiryMode: ExpiryMode;
  customExpiry: string;
  file: File | null;
  /** The main document's name/remark (required). */
  fileLabel: string;
  extraFiles: ExtraFile[];
  compressing: boolean;
  notice: string;
  status: ServiceRowStatus;
  /** Translation key under `submissionErrors`. */
  errorCode: string;
};

/** A blank service; `seed` carries over the date / sales person / maincon (e.g. from the service above). */
export function newServiceRow(seed: Partial<Pick<ServiceRow, "category" | "serviceDate" | "salesPerson" | "maincon">> = {}): ServiceRow {
  return {
    key: crypto.randomUUID(),
    category: "",
    serviceDate: "",
    salesPerson: "",
    maincon: "",
    expiryMode: "auto",
    customExpiry: "",
    file: null,
    fileLabel: "",
    extraFiles: [],
    compressing: false,
    notice: "",
    status: "idle",
    errorCode: "",
    ...seed,
  };
}

const KNOWN_ERROR_CODES = new Set([
  "MISSING_SALES_PERSON",
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
  "serviceDateRequired",
  "fileLabelRequired",
  "extraFileIncomplete",
  "INVALID_FILE_LABEL",
  "TOO_MANY_FILES",
]);

export function knownErrorCode(code: string | undefined) {
  return code && KNOWN_ERROR_CODES.has(code) ? code : "GENERIC";
}

/** The expiry this row will be saved with ("" = no fixed expiry). */
export function effectiveExpiry(row: ServiceRow) {
  if (row.expiryMode === "none") return "";
  if (row.expiryMode === "custom") return row.customExpiry;
  return row.serviceDate ? (defaultExpiryFor(row.category, row.serviceDate) ?? "") : "";
}

/**
 * Uploads one service's report straight to Storage and appends its
 * category, dates, storage path and (for PDFs) a thumbnail. Returns an
 * error code if the upload itself failed, otherwise null.
 */
export async function appendServiceReport(formData: FormData, row: ServiceRow): Promise<string | null> {
  formData.append("category", row.category);
  formData.append("serviceDate", row.serviceDate);
  appendJobDetails(formData, { salesPerson: row.salesPerson, maincon: row.maincon });
  // Always sent, so the server stores exactly what the row showed.
  formData.append("expiryDate", effectiveExpiry(row));
  if (!row.file) return null;
  formData.append("fileLabel", row.fileLabel.trim());
  const uploadError = await appendUploadedFile(formData, row.file);
  if (uploadError) return uploadError;
  // The other documents of this report go straight to Storage too, each
  // sent with its own name/remark (the server checks every one).
  for (const extra of row.extraFiles) {
    if (!extra.file) continue;
    const result = await uploadReportFile(extra.file);
    if ("error" in result) return result.error;
    formData.append("extraStoragePath", result.storagePath);
    formData.append("extraFileName", extra.file.name);
    formData.append("extraFileLabel", extra.label.trim());
  }
  if (row.file.type === "application/pdf") {
    const thumbnail = await generatePdfThumbnail(row.file).catch(() => null);
    if (thumbnail) formData.append("thumbnail", thumbnail);
  }
  return null;
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
export async function uploadServiceRows(clientId: string, rows: ServiceRow[], setRows: Dispatch<SetStateAction<ServiceRow[]>>) {
  let allSaved = true;
  for (const row of rows) {
    if (row.status === "done") continue;
    patchRow(setRows, row.key, { status: "uploading", errorCode: "" });
    try {
      const formData = new FormData();
      const uploadError = await appendServiceReport(formData, row);
      if (uploadError) {
        allSaved = false;
        patchRow(setRows, row.key, { status: "error", errorCode: knownErrorCode(uploadError) });
        continue;
      }
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
export function validateServiceRows(rows: ServiceRow[], setRows: Dispatch<SetStateAction<ServiceRow[]>>) {
  // The browser's own `required` check normally stops the form first (see
  // each row's date / sales person onInvalid); this is the backstop.
  const problems = new Map<string, string>();
  for (const row of rows) {
    if (row.status === "done") continue;
    if (!row.category) problems.set(row.key, "INVALID_CATEGORY");
    else if (!row.serviceDate) problems.set(row.key, "serviceDateRequired");
    else if (!row.salesPerson.trim()) problems.set(row.key, "MISSING_SALES_PERSON");
    else if (row.expiryMode === "custom" && (!row.customExpiry || row.customExpiry <= row.serviceDate)) problems.set(row.key, "INVALID_EXPIRY_DATE");
    else if (!row.file) problems.set(row.key, "noFile");
    else if (!row.fileLabel.trim()) problems.set(row.key, "fileLabelRequired");
    else if (row.extraFiles.some((extra) => !extra.file || !extra.label.trim())) problems.set(row.key, "extraFileIncomplete");
  }
  if (problems.size > 0) {
    setRows((current) => current.map((row) => (problems.has(row.key) ? { ...row, status: "error", errorCode: problems.get(row.key)! } : row)));
    const first = rows.find((row) => problems.has(row.key))!;
    const code = problems.get(first.key);
    const fieldId = code === "serviceDateRequired" ? serviceDateInputId(first.key) : code === "MISSING_SALES_PERSON" ? salesPersonInputId(first.key) : null;
    if (fieldId) document.getElementById(fieldId)?.focus();
  }
  return problems.size === 0;
}

/** Client-only step's sales person field (JobDetailsFields). */
export const SALES_PERSON_INPUT_ID = "sales-person";
/** Each service's own fields. */
export const serviceDateInputId = (rowKey: string) => `service-date-${rowKey}`;
export const salesPersonInputId = (rowKey: string) => `sales-person-${rowKey}`;

const fieldClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-60";

type Props = {
  rows: ServiceRow[];
  setRows: Dispatch<SetStateAction<ServiceRow[]>>;
  /** Locks every row (e.g. mid-upload, or after a partial save). */
  locked?: boolean;
};

export function ServiceReportsFields({ rows, setRows, locked = false }: Props) {
  const t = useTranslations("services");
  const tSubmit = useTranslations("submit");
  const tErrors = useTranslations("submissionErrors");
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");
  const tExpiry = useTranslations("expiry");
  const today = todayInMalaysia();
  const yesterday = addDays(today, -1);
  // The same service twice is fine on different dates, not on the same one.
  const chosen = rows.filter((row) => row.category).map((row) => `${row.category}|${row.serviceDate}`);

  // Editing a field clears that field's error on the row.
  function patchField(row: ServiceRow, patch: Partial<ServiceRow>, errorCodes: string[]) {
    patchRow(setRows, row.key, errorCodes.includes(row.errorCode) ? { ...patch, status: "idle", errorCode: "" } : patch);
  }

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

  function patchExtra(row: ServiceRow, key: string, patch: Partial<ExtraFile>) {
    setRows((current) =>
      current.map((item) =>
        item.key === row.key
          ? { ...item, status: "idle", errorCode: "", extraFiles: item.extraFiles.map((extra) => (extra.key === key ? { ...extra, ...patch } : extra)) }
          : item,
      ),
    );
  }

  // Extra documents go up as they are (no automatic PDF compression).
  function chooseExtraFile(row: ServiceRow, key: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > MAX_FILE_SIZE) {
      event.target.value = "";
      patchExtra(row, key, { file: null });
      patchRow(setRows, row.key, { status: "error", errorCode: "FILE_SIZE" });
      return;
    }
    patchExtra(row, key, { file });
  }

  return (
    <div>
      <ol className="space-y-3">
        {rows.map((row, index) => {
          const rowLocked = locked || row.status === "uploading" || row.status === "done";
          const duplicate = row.category && chosen.filter((value) => value === `${row.category}|${row.serviceDate}`).length > 1;
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
                          {tCategories(categoryMessageKey(category))}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <FilePicker
                  file={row.file}
                  disabled={rowLocked || row.compressing}
                  busy={row.compressing}
                  emptyLabel={row.compressing ? tSubmit("compressing") : t("chooseReport")}
                  hint={t("fileTypes")}
                  onChange={(event) => chooseFile(row, event)}
                />
              </div>

              <input
                type="text"
                required={row.status !== "done" && Boolean(row.file)}
                value={row.fileLabel}
                disabled={rowLocked}
                maxLength={MAX_FILE_LABEL_LENGTH}
                onChange={(event) => patchRow(setRows, row.key, { fileLabel: event.target.value, ...(row.errorCode === "fileLabelRequired" ? { status: "idle", errorCode: "" } : {}) })}
                placeholder={t("fileLabelPlaceholder")}
                aria-label={t("fileLabel", { number: 1 })}
                className={`${fieldClass} mt-3`}
              />

              {row.extraFiles.length > 0 && (
                <ol className="mt-3 space-y-2 border-l-2 border-accent-soft pl-3">
                  {row.extraFiles.map((extra, extraIndex) => (
                    <li key={extra.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <FilePicker
                        file={extra.file}
                        disabled={rowLocked}
                        emptyLabel={t("chooseExtraFile")}
                        hint={t("fileTypes")}
                        onChange={(event) => chooseExtraFile(row, extra.key, event)}
                      />
                      <input
                        type="text"
                        required={row.status !== "done"}
                        value={extra.label}
                        disabled={rowLocked}
                        maxLength={MAX_FILE_LABEL_LENGTH}
                        onChange={(event) => patchExtra(row, extra.key, { label: event.target.value })}
                        placeholder={t("extraFileLabelPlaceholder")}
                        aria-label={t("fileLabel", { number: extraIndex + 2 })}
                        className={fieldClass}
                      />
                      {!rowLocked && (
                        <button
                          type="button"
                          onClick={() => patchRow(setRows, row.key, { extraFiles: row.extraFiles.filter((item) => item.key !== extra.key), status: "idle", errorCode: "" })}
                          className="grid h-9 w-9 place-items-center justify-self-end rounded-full text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                          aria-label={t("removeExtraFile", { number: extraIndex + 2 })}
                        >
                          <Close className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {!rowLocked && row.extraFiles.length < MAX_EXTRA_FILES && (
                <button
                  type="button"
                  onClick={() => patchRow(setRows, row.key, { extraFiles: [...row.extraFiles, { key: crypto.randomUUID(), file: null, label: "" }] })}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("addExtraFile")}
                  <span className="font-normal text-ink-faint">· {t("optional")}</span>
                </button>
              )}

              <div className="mt-3 grid gap-3 rounded-xl border border-line bg-surface-soft p-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <label htmlFor={serviceDateInputId(row.key)} className="flex items-center gap-1.5 text-xs font-semibold">
                    <Calendar className="h-3.5 w-3.5 text-accent" /> {t("monitoringDate")}
                  </label>
                  <input
                    id={serviceDateInputId(row.key)}
                    type="date"
                    required={row.status !== "done"}
                    min="2000-01-01"
                    max={today}
                    value={row.serviceDate}
                    disabled={rowLocked}
                    onChange={(event) => patchField(row, { serviceDate: event.target.value }, ["serviceDateRequired", "INVALID_SERVICE_DATE", "INVALID_EXPIRY_DATE"])}
                    onInvalid={(event) => {
                      // Our own message on the row instead of the browser bubble.
                      event.preventDefault();
                      patchRow(setRows, row.key, { status: "error", errorCode: "serviceDateRequired" });
                      event.currentTarget.focus();
                    }}
                    aria-invalid={row.errorCode === "serviceDateRequired"}
                    className={`${fieldClass} mt-1.5 py-2.5 font-medium tabular-nums ${row.serviceDate ? "" : "text-ink-faint"} ${row.errorCode === "serviceDateRequired" ? "border-danger" : ""}`}
                  />
                  {!rowLocked && (
                    <div className="mt-1.5 flex gap-1.5">
                      {[
                        { value: today, label: t("todayChip") },
                        { value: yesterday, label: t("yesterday") },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => patchField(row, { serviceDate: option.value }, ["serviceDateRequired", "INVALID_SERVICE_DATE", "INVALID_EXPIRY_DATE"])}
                          aria-pressed={row.serviceDate === option.value}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            row.serviceDate === option.value ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-muted hover:border-accent hover:text-accent"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <label htmlFor={salesPersonInputId(row.key)} className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    {t("salesPerson")}
                    {!row.salesPerson.trim() && <span className="rounded-full bg-amber-soft px-1.5 py-px font-mono text-[9px] font-bold tracking-wide text-amber">{t("required")}</span>}
                  </label>
                  <input
                    id={salesPersonInputId(row.key)}
                    required={row.status !== "done"}
                    maxLength={MAX_SALES_PERSON_LENGTH}
                    value={row.salesPerson}
                    disabled={rowLocked}
                    onChange={(event) => patchField(row, { salesPerson: event.target.value }, ["MISSING_SALES_PERSON"])}
                    onInvalid={(event) => {
                      event.preventDefault();
                      patchRow(setRows, row.key, { status: "error", errorCode: "MISSING_SALES_PERSON" });
                      event.currentTarget.focus();
                    }}
                    aria-invalid={row.errorCode === "MISSING_SALES_PERSON"}
                    placeholder={t("salesPersonPlaceholder")}
                    autoComplete="off"
                    className={`${fieldClass} mt-1.5 py-2.5 ${row.errorCode === "MISSING_SALES_PERSON" ? "border-danger" : ""}`}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor={`maincon-${row.key}`} className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    {t("maincon")}
                    <span className="rounded-full bg-surface px-1.5 py-px font-mono text-[9px] font-bold tracking-wide text-ink-muted">{t("optional")}</span>
                  </label>
                  <input
                    id={`maincon-${row.key}`}
                    maxLength={MAX_MAINCON_LENGTH}
                    value={row.maincon}
                    disabled={rowLocked}
                    onChange={(event) => patchRow(setRows, row.key, { maincon: event.target.value })}
                    placeholder={t("directJob")}
                    autoComplete="off"
                    className={`${fieldClass} mt-1.5 py-2.5`}
                  />
                </div>
              </div>

              {row.category && <ExpiryStrip row={row} serviceDate={row.serviceDate} locked={rowLocked} onChange={(patch) => patchRow(setRows, row.key, patch)} t={tExpiry} />}

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
          onClick={() =>
            setRows((current) => {
              const last = current[current.length - 1];
              return [...current, newServiceRow(last ? { serviceDate: last.serviceDate, salesPerson: last.salesPerson, maincon: last.maincon } : {})];
            })
          }
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
  const autoExpiry = serviceDate ? defaultExpiryFor(row.category, serviceDate) : null;
  const linkClass = "font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-50";

  // Expiry is counted from the date of monitoring, so there's nothing to
  // show until staff have keyed it in.
  if (!serviceDate) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-line bg-surface-soft px-3.5 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <Hourglass className="h-3.5 w-3.5 text-ink-faint" /> {t("validUntil")}
        </span>
        <span className="text-ink-muted">{t("waitingForDate")}</span>
        {rule && <span className="basis-full text-[11px] leading-4 text-ink-faint">{rule.basis}</span>}
      </div>
    );
  }

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

/**
 * Who owns the job, and the main contractor when it came through one. Used
 * by every report form and by "client details only" (saved on the client and
 * pre-filled when its report is attached later).
 */
export function JobDetailsFields({ job, onJobChange, locked = false, className = "mt-4" }: { job: JobDetails; onJobChange: (job: JobDetails) => void; locked?: boolean; className?: string }) {
  const t = useTranslations("services");
  const [salesPersonMissing, setSalesPersonMissing] = useState(false);
  return (
      <div className={`${className} grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5`}>
        <div>
          <label htmlFor={SALES_PERSON_INPUT_ID} className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {t("salesPerson")}
            {!job.salesPerson.trim() && <span className="rounded-full bg-amber-soft px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-amber">{t("required")}</span>}
          </label>
          <input
            id={SALES_PERSON_INPUT_ID}
            required
            maxLength={MAX_SALES_PERSON_LENGTH}
            value={job.salesPerson}
            disabled={locked}
            onChange={(event) => {
              onJobChange({ ...job, salesPerson: event.target.value });
              if (event.target.value.trim()) setSalesPersonMissing(false);
            }}
            onInvalid={(event) => {
              event.preventDefault();
              setSalesPersonMissing(true);
              event.currentTarget.focus();
            }}
            aria-invalid={salesPersonMissing}
            aria-describedby="sales-person-hint"
            placeholder={t("salesPersonPlaceholder")}
            autoComplete="off"
            className={`${fieldClass} mt-2 ${salesPersonMissing ? "border-danger focus:border-danger focus:ring-danger-soft" : ""}`}
          />
          {salesPersonMissing ? (
            <p id="sales-person-hint" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {t("salesPersonRequiredError")}
            </p>
          ) : (
            <p id="sales-person-hint" className="mt-1.5 text-xs text-ink-muted">
              {t("salesPersonHint")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="maincon" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {t("maincon")}
            <span className="rounded-full bg-surface-soft px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-ink-muted">{t("optional")}</span>
          </label>
          <input
            id="maincon"
            maxLength={MAX_MAINCON_LENGTH}
            value={job.maincon}
            disabled={locked}
            onChange={(event) => onJobChange({ ...job, maincon: event.target.value })}
            aria-describedby="maincon-hint"
            autoComplete="off"
            className={`${fieldClass} mt-2`}
          />
          <p id="maincon-hint" className="mt-1.5 text-xs text-ink-muted">
            {t("mainconHint")}
          </p>
        </div>
      </div>
  );
}

function formatPickedSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** The dashed "choose a file" box used for a report's main and extra documents. */
function FilePicker({
  file,
  disabled,
  busy = false,
  emptyLabel,
  hint,
  onChange,
}: {
  file: File | null;
  disabled: boolean;
  busy?: boolean;
  emptyLabel: string;
  hint: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={`flex min-w-0 items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5 text-sm transition-colors ${
        disabled ? "pointer-events-none" : "cursor-pointer hover:border-accent hover:bg-accent-soft/50"
      } ${file ? "border-accent/50 bg-accent-soft/30" : "border-line bg-surface-soft"}`}
    >
      <input type="file" accept=".pdf,.doc,.docx" disabled={disabled} onChange={onChange} className="sr-only" />
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-accent shadow-sm">
        {file ? <File className="h-4 w-4" /> : <Upload className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{busy ? emptyLabel : (file?.name ?? emptyLabel)}</span>
        <span className="block truncate text-[11px] text-ink-muted">{file ? formatPickedSize(file.size) : hint}</span>
      </span>
    </label>
  );
}
