"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Close, Plus } from "@/app/_components/icons";
import { newServiceRow, ServiceReportsFields, uploadServiceRows, validateServiceRows, type ServiceRow } from "@/app/_components/service-reports-fields";
import { useRouter } from "@/i18n/routing";
import { todayInMalaysia } from "@/lib/format";

/**
 * "Add a service" on a client's record page — for a later visit (or a
 * service that was missed off the original submission) without retyping
 * the company. Same date + service rows as /submit, each report uploaded
 * on its own to the existing client.
 */
export function AddServicePanel({ clientId, companyName }: { clientId: string; companyName: string }) {
  const t = useTranslations("services");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(todayInMalaysia);
  const [rows, setRows] = useState<ServiceRow[]>(() => [newServiceRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(0);

  const isCompressing = rows.some((row) => row.compressing);
  const anySaved = rows.some((row) => row.status === "done");
  const pending = rows.filter((row) => row.status !== "done").length;

  function reset() {
    setRows([newServiceRow()]);
    setServiceDate(todayInMalaysia());
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCompressing || !validateServiceRows(rows, setRows)) return;
    setError("");
    setIsSaving(true);
    const savedCount = rows.length;
    const allSaved = await uploadServiceRows(clientId, rows, serviceDate, setRows);
    setIsSaving(false);
    router.refresh();
    if (allSaved) {
      setJustSaved(savedCount);
      setOpen(false);
      reset();
    } else {
      setError(t("partialSaved"));
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {justSaved > 0 && (
          <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent animate-[rise_.35s_ease-out_both]" role="status">
            {t("addedConfirmation", { count: justSaved })}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setJustSaved(0);
            setOpen(true);
          }}
          className="group inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(16,42,51,.18)] transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> {t("addServiceToClient")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-5 w-full rounded-[1.5rem] border border-accent-soft bg-accent-soft/25 p-5 animate-[rise_.35s_ease-out_both] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-accent">{t("newVisitEyebrow")}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em]">{t("newVisitTitle", { company: companyName })}</h3>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            setOpen(false);
            if (!anySaved) reset();
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          aria-label={t("cancel")}
        >
          <Close className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5">
        <ServiceReportsFields serviceDate={serviceDate} onServiceDateChange={setServiceDate} rows={rows} setRows={setRows} locked={isSaving || anySaved} />
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <button
          type="submit"
          disabled={isSaving || isCompressing}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(15,118,110,.18)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? t("saving") : anySaved ? t("retryFailed", { count: pending }) : t("saveServices", { count: rows.length })}
        </button>
      </div>
    </form>
  );
}
