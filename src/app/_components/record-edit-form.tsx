"use client";

import { useTranslations } from "next-intl";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { addEntry, removeEntry, RepeatableField, updateEntry } from "@/app/_components/repeatable-field";
import { useRouter } from "@/i18n/routing";
import { compressPdf } from "@/lib/compress-pdf";
import { generatePdfThumbnail } from "@/lib/generate-pdf-thumbnail";
import { CATEGORY_GROUPS } from "@/lib/format";
import type { RecordDetail } from "@/lib/supabase/queries";

const MAX_FILE_SIZE = 4 * 1024 * 1024;

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fieldClass = "mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

const KNOWN_ERROR_CODES = [
  "MISSING_FIELDS",
  "INVALID_EMAIL",
  "INVALID_CATEGORY",
  "INVALID_FILE_TYPE",
  "FILE_SIZE",
  "CLIENT_SAVE_ERROR",
  "UPLOAD_ERROR",
  "DOCUMENT_SAVE_ERROR",
  "FILE_TOO_LARGE_AFTER_COMPRESSION",
  "FILE_TYPE_CANNOT_COMPRESS",
  "TOO_MANY_CONTACTS",
] as const;

export function RecordEditForm({ record, onDone }: { record: RecordDetail; onDone: () => void }) {
  const t = useTranslations("record.edit");
  const tSubmit = useTranslations("submit");
  const tErrors = useTranslations("submissionErrors");
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");
  const router = useRouter();

  const [clientNames, setClientNames] = useState<string[]>([record.clientName, ...record.additionalClientNames]);
  const [companyName, setCompanyName] = useState(record.companyName);
  const [telephones, setTelephones] = useState<string[]>([record.telephone, ...record.additionalTelephones]);
  const [emails, setEmails] = useState<string[]>([record.email, ...record.additionalEmails]);
  const [submitterName, setSubmitterName] = useState(record.submitterName);
  const [category, setCategory] = useState(record.category ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function errorMessage(code: string | undefined) {
    if (code && (KNOWN_ERROR_CODES as readonly string[]).includes(code)) return tErrors(code as (typeof KNOWN_ERROR_CODES)[number]);
    if (code === "NOT_FOUND") return t("NOT_FOUND");
    return t("GENERIC");
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setCompressionNotice("");

    if (!file || file.size <= MAX_FILE_SIZE) {
      setSelectedFile(file);
      return;
    }

    if (file.type !== "application/pdf") {
      setSelectedFile(null);
      event.target.value = "";
      setError(tErrors("FILE_TYPE_CANNOT_COMPRESS"));
      return;
    }

    setIsCompressing(true);
    setSelectedFile(null);
    try {
      const result = await compressPdf(file, MAX_FILE_SIZE);
      if (!result.ok) {
        event.target.value = "";
        setError(tErrors("FILE_TOO_LARGE_AFTER_COMPRESSION"));
        return;
      }
      setSelectedFile(result.file);
      setCompressionNotice(tSubmit("compressedNotice", { originalSize: formatMegabytes(result.originalSize), newSize: formatMegabytes(result.compressedSize) }));
    } finally {
      setIsCompressing(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const formData = new FormData();
    clientNames.filter(Boolean).forEach((name) => formData.append("clientName", name));
    formData.append("companyName", companyName);
    telephones.filter(Boolean).forEach((tel) => formData.append("telephone", tel));
    emails.filter(Boolean).forEach((value) => formData.append("email", value));
    formData.append("submitterName", submitterName);
    if (category) formData.append("category", category);
    if (selectedFile) {
      formData.append("file", selectedFile);
      if (selectedFile.type === "application/pdf") {
        const thumbnail = await generatePdfThumbnail(selectedFile).catch(() => null);
        if (thumbnail) formData.append("thumbnail", thumbnail);
      }
    }

    try {
      const response = await fetch(`/api/records/${record.id}`, { method: "PATCH", body: formData });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(errorMessage(result.error));
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError(t("GENERIC"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-7 rounded-2xl border border-accent-soft bg-accent-soft/30 p-5 sm:p-6">
      <label className="text-sm font-semibold">
        {t("companyName")}
        <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={fieldClass} />
      </label>

      <div className="mt-5">
        <RepeatableField
          label={t("clientName")}
          name="clientName"
          placeholder=""
          removeLabel={tSubmit("removeEntry")}
          addLabel={tSubmit("addAnotherClientName")}
          values={clientNames}
          onChange={(index, value) => updateEntry(setClientNames, index, value)}
          onAdd={() => addEntry(setClientNames)}
          onRemove={(index) => removeEntry(setClientNames, index)}
        />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <RepeatableField
          label={t("telephone")}
          name="telephone"
          type="tel"
          placeholder=""
          removeLabel={tSubmit("removeEntry")}
          addLabel={tSubmit("addAnotherTelephone")}
          values={telephones}
          onChange={(index, value) => updateEntry(setTelephones, index, value)}
          onAdd={() => addEntry(setTelephones)}
          onRemove={(index) => removeEntry(setTelephones, index)}
        />
        <RepeatableField
          label={t("email")}
          name="email"
          type="email"
          placeholder=""
          removeLabel={tSubmit("removeEntry")}
          addLabel={tSubmit("addAnotherEmail")}
          values={emails}
          onChange={(index, value) => updateEntry(setEmails, index, value)}
          onAdd={() => addEntry(setEmails)}
          onRemove={(index) => removeEntry(setEmails, index)}
        />
      </div>

      <label className="mt-5 block text-sm font-semibold">
        {t("submitterName")}
        <input required value={submitterName} onChange={(event) => setSubmitterName(event.target.value)} className={fieldClass} />
      </label>

      <label className={`mt-5 block rounded-xl border border-dashed border-line bg-surface p-5 text-center transition-colors ${isCompressing ? "pointer-events-none opacity-60" : "cursor-pointer hover:bg-surface-soft"}`}>
        <input disabled={isCompressing} type="file" accept=".pdf,.doc,.docx" onChange={chooseFile} className="sr-only" />
        <span className="block text-sm font-semibold">{isCompressing ? tSubmit("compressing") : selectedFile?.name || (record.hasDocument ? t("replaceDocument") : t("attachDocument"))}</span>
        {!record.hasDocument && !selectedFile && <span className="mt-1 block text-xs text-ink-muted">{tSubmit("fileHint")}</span>}
        {record.hasDocument && !selectedFile && <span className="mt-1 block text-xs text-ink-muted">{t("keepExistingFile")}</span>}
      </label>
      {compressionNotice && <p className="mt-2 text-xs text-ink-muted">{compressionNotice}</p>}

      {/* Category only matters once a document exists or is being attached right now. */}
      {(record.hasDocument || selectedFile) && (
        <label className="mt-5 block text-sm font-semibold">
          {tSubmit("documentCategory")}
          <select required value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
            <option value="" disabled>
              {tSubmit("selectCategory")}
            </option>
            {CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.group} label={tGroups(group.group)}>
                {group.categories.map((categoryOption) => (
                  <option key={categoryOption} value={categoryOption}>
                    {tCategories(categoryOption)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <button type="submit" disabled={isSaving || isCompressing} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60">
          {isSaving ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onDone} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:text-accent">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
