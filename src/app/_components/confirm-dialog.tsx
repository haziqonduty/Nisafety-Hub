"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";
import { AlertTriangle } from "@/app/_components/icons";

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  /** Small summary of who/what is affected, shown in a card under the title. */
  subject?: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A "are you sure?" modal for risky admin actions (native <dialog>, so focus
 * trapping, Escape-to-close and the top layer come for free). Cancel gets
 * initial focus, so pressing Enter by accident never confirms. While the
 * action is running the dialog can't be dismissed; on failure it stays open
 * and shows the error.
 */
export function ConfirmDialog({ open, title, description, subject, confirmLabel, busyLabel, busy, error, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function dismiss() {
    if (!busy) onCancel();
  }

  // Escape fires "cancel" first — block it mid-action, otherwise treat it as Cancel.
  function onNativeCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    dismiss();
  }

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) dismiss();
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onNativeCancel}
      onClick={onBackdropClick}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="m-auto w-[min(100vw-2rem,28rem)] max-w-none overflow-hidden rounded-[1.5rem] border border-line bg-surface p-0 text-ink shadow-[0_30px_90px_rgba(2,12,18,.35)] backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm open:animate-[rise_.3s_ease-out_both]"
    >
      <div className="relative px-6 pb-6 pt-7 sm:px-7">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-danger/0 via-danger to-danger/0" />

        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger ring-8 ring-danger-soft/40">
          <AlertTriangle className="h-5 w-5" />
        </span>

        <h2 id="confirm-dialog-title" className="mt-5 text-lg font-semibold tracking-[-0.03em]">
          {title}
        </h2>
        <div id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-ink-muted">
          {description}
        </div>

        {subject && <div className="mt-4 rounded-xl border border-line bg-surface-soft px-4 py-3">{subject}</div>}

        {error && (
          <p className="mt-4 rounded-xl bg-danger-soft px-4 py-2.5 text-xs font-medium text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(220,38,38,.25)] transition hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-70"
          >
            {busy && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
