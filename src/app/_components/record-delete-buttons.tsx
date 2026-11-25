"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Close, RefreshCw, Trash } from "@/app/_components/icons";
import { useRouter } from "@/i18n/routing";

/**
 * Staff delete actions on a record page. Both are PERMANENT (no recycle bin
 * for staff deletes — Kay's choice, 2026-11-25), so each asks first; a whole
 * client also needs its company name typed back.
 */

const triggerClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-danger hover:bg-danger-soft hover:text-danger print:hidden";

function ConfirmDeleteDialog({
  dialogRef,
  titleId,
  title,
  children,
  canConfirm,
  saving,
  error,
  onConfirm,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  titleId: string;
  title: string;
  children: ReactNode;
  canConfirm: boolean;
  saving: boolean;
  error: string;
  onConfirm: () => void;
}) {
  const t = useTranslations("record.delete");
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[1.5rem] border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_rgba(16,42,51,.25)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-danger">{t("eyebrow")}</p>
              <h2 id={titleId} className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t("cancel")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <Close className="h-4 w-4" />
          </button>
        </div>

        {children}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink">
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || saving}
            className="inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
            {saving ? t("deleting") : t("confirm")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function useDelete(url: string, onDeleted: (result: { clientId?: string }) => void) {
  const t = useTranslations("record.delete");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setError("");
    dialogRef.current?.showModal();
  }

  async function run() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(url, { method: "DELETE" });
      if (response.status === 404) throw new Error("NOT_FOUND");
      if (!response.ok) throw new Error("FAILED");
      const result = (await response.json()) as { clientId?: string };
      dialogRef.current?.close();
      onDeleted(result);
    } catch (problem) {
      setError(problem instanceof Error && problem.message === "NOT_FOUND" ? t("notFound") : t("error"));
      setSaving(false);
    }
  }

  return { dialogRef, saving, error, open, run };
}

/** One report. The client and its other reports stay. */
export function DeleteReportButton({ documentId, fileName, category }: { documentId: string; fileName: string; category: string }) {
  const t = useTranslations("record.delete");
  const router = useRouter();
  const action = useDelete(`/api/documents/${documentId}`, ({ clientId }) => {
    // The client's page shows its newest remaining report (or "client details only").
    router.replace(clientId ? `/records/${clientId}` : "/");
    router.refresh();
  });

  return (
    <>
      <button type="button" onClick={action.open} className={triggerClass}>
        <Trash className="h-3.5 w-3.5" /> {t("reportButton")}
      </button>
      <ConfirmDeleteDialog
        dialogRef={action.dialogRef}
        titleId={`delete-report-${documentId}`}
        title={t("reportTitle")}
        canConfirm
        saving={action.saving}
        error={action.error}
        onConfirm={action.run}
      >
        <p className="mt-4 rounded-xl bg-surface-soft px-3.5 py-2.5 text-sm">
          <span className="font-semibold">{category}</span>
          <span className="block break-all text-xs text-ink-muted">{fileName}</span>
        </p>
        <p className="mt-4 text-sm text-ink-muted">{t("reportBody")}</p>
      </ConfirmDeleteDialog>
    </>
  );
}

/** The whole company record with every report and file. Needs the name typed back. */
export function DeleteClientButton({ clientId, companyName, reportCount }: { clientId: string; companyName: string; reportCount: number }) {
  const t = useTranslations("record.delete");
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const action = useDelete(`/api/clients/${clientId}`, () => {
    router.replace("/");
    router.refresh();
  });
  const matches = typed.trim().toLowerCase() === companyName.trim().toLowerCase();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          action.open();
        }}
        className={triggerClass}
      >
        <Trash className="h-3.5 w-3.5" /> {t("clientButton")}
      </button>
      <ConfirmDeleteDialog
        dialogRef={action.dialogRef}
        titleId={`delete-client-${clientId}`}
        title={t("clientTitle")}
        canConfirm={matches}
        saving={action.saving}
        error={action.error}
        onConfirm={action.run}
      >
        <p className="mt-4 rounded-xl bg-surface-soft px-3.5 py-2.5 text-sm">
          <span className="font-semibold">{companyName}</span>
          <span className="block text-xs text-ink-muted">{t("clientReportCount", { count: reportCount })}</span>
        </p>
        <p className="mt-4 text-sm text-ink-muted">{t("clientBody")}</p>
        <label className="mt-4 block text-sm font-semibold">
          {t("typeToConfirm")}
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={companyName}
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm font-normal outline-none transition focus:border-danger focus:ring-4 focus:ring-danger-soft"
          />
        </label>
      </ConfirmDeleteDialog>
    </>
  );
}
