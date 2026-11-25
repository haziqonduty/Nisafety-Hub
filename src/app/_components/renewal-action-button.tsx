"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Check, Close, RefreshCw } from "@/app/_components/icons";
import { useRouter } from "@/i18n/routing";
import { RENEWAL_CLOSE_REASONS, type RenewalCloseReason } from "@/lib/validity";

const BUTTON_STYLES = {
  /** Small, for the workspace banner chips. */
  chip: "gap-1 rounded-lg px-2 py-1 text-[11px]",
  /** Next to "Renew" in the tracker and on the record page. */
  pill: "gap-1.5 rounded-full px-3.5 py-1.5 text-xs",
} as const;

/**
 * "Action taken": closes a report's renewal when the job isn't coming back to
 * Nisafety (e.g. the client used another consultant). Asks why in a dialog,
 * then the report stops counting as expired/expiring everywhere.
 */
export function RenewalActionButton({
  documentId,
  company,
  service,
  variant = "pill",
}: {
  documentId: string;
  company: string;
  service: string;
  variant?: keyof typeof BUTTON_STYLES;
}) {
  const t = useTranslations("expiry");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<RenewalCloseReason>("other_consultant");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  function open() {
    setError(false);
    dialog.current?.showModal();
  }

  async function confirm() {
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/records/${documentId}/renewal-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error(String(response.status));
      dialog.current?.close();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={`inline-flex shrink-0 items-center whitespace-nowrap border border-line bg-surface font-semibold text-ink-muted transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent ${BUTTON_STYLES[variant]}`}
      >
        <Check className="h-3.5 w-3.5" /> {t("actionTakenButton")}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`action-title-${documentId}`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[1.5rem] border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_rgba(16,42,51,.25)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-accent">{t("actionEyebrow")}</p>
              <h2 id={`action-title-${documentId}`} className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">
                {t("actionTitle")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label={t("actionCancel")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
            >
              <Close className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 rounded-xl bg-surface-soft px-3.5 py-2.5 text-sm">
            <span className="font-semibold">{company}</span>
            <span className="text-ink-muted"> · {service}</span>
          </p>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">{t("actionReasonLabel")}</legend>
            <div className="mt-2.5 grid gap-2">
              {RENEWAL_CLOSE_REASONS.map((value) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                    reason === value ? "border-accent bg-accent-soft/60 font-semibold" : "border-line hover:border-accent/50"
                  }`}
                >
                  <input type="radio" name={`reason-${documentId}`} value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[var(--color-accent)]" />
                  {t(`reason.${value}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="mt-4 text-xs text-ink-muted">{t("actionHint")}</p>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              {t("actionError")}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink">
              {t("actionCancel")}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t("actionConfirm")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Record page: reopen a closed renewal so the report is tracked again. */
export function RenewalUndoButton({ documentId }: { documentId: string }) {
  const t = useTranslations("expiry");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function undo() {
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/records/${documentId}/renewal-action`, { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={undo}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} /> {t("actionUndo")}
      </button>
      {error && (
        <span role="alert" className="text-xs font-semibold text-danger">
          {t("actionError")}
        </span>
      )}
    </span>
  );
}
