"use client";

import { useEffect, useRef, useState, type MouseEvent, type UIEvent } from "react";
import { Close } from "@/app/_components/icons";
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from "@/lib/terms";

type Props = {
  open: boolean;
  onClose: () => void;
  onAgree: () => void;
};

/**
 * Terms & Conditions as an in-page modal on sign-up (native <dialog>, so
 * focus trapping, Escape-to-close and the top layer come for free) instead
 * of a separate route — the half-filled form is never left behind.
 */
export function TermsDialog({ open, onClose, onAgree }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const reachedEnd = progress >= 0.98;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const body = bodyRef.current;
      if (body) {
        body.scrollTop = 0;
        // Short viewports/zoom levels where everything fits with no
        // scrollbar: there's nothing to scroll, so count it as read.
        setProgress(body.scrollHeight <= body.clientHeight + 1 ? 1 : 0);
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max <= 0 ? 1 : el.scrollTop / max);
  }

  // The backdrop is a pseudo-element of the dialog itself, so a click that
  // lands on the backdrop reports the <dialog> as its target; anything
  // inside the panel reports a descendant instead.
  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={onBackdropClick}
      aria-labelledby="terms-dialog-title"
      className="m-auto w-[min(100vw-2rem,42rem)] max-w-none overflow-hidden rounded-[1.5rem] border border-white/15 bg-slate-900/85 p-0 text-white shadow-[0_30px_90px_rgba(0,0,0,.6)] backdrop-blur-2xl backdrop-saturate-150 backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm open:animate-[rise_.35s_ease-out_both] max-sm:mb-0 max-sm:mt-auto max-sm:w-screen max-sm:rounded-b-none"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="relative shrink-0 border-b border-white/10 px-6 pb-4 pt-5 sm:px-8">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[2px] origin-left bg-teal-400 transition-transform duration-150 ease-out"
            style={{ transform: `scaleX(${progress})` }}
          />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-teal-300">LEGAL</p>
              <h2 id="terms-dialog-title" className="mt-1.5 text-xl font-semibold tracking-[-0.04em] sm:text-2xl">
                Terms &amp; Conditions
              </h2>
              <p className="mt-1 text-xs text-white/60">Last updated: {TERMS_LAST_UPDATED}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-teal-300 hover:text-teal-300"
            >
              <Close className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={bodyRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8">
          <p className="text-sm leading-7 text-white/75">
            These terms govern the use of Nisafety Hub by Nisafety Consultancy staff. By creating an account or signing in, you agree
            to them.
          </p>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-white/60">
            This is an operational description of how this internal platform is meant to be used — not a substitute for legal advice.
            Nisafety Consultancy should have it reviewed by qualified legal counsel, particularly the data-protection section, before
            relying on it for compliance purposes.
          </div>
          <div className="mt-8 space-y-7">
            {TERMS_SECTIONS.map((section) => (
              <section key={section.title}>
                <h3 className="text-sm font-semibold tracking-[-0.02em] text-white">{section.title}</h3>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-sm leading-7 text-white/70">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 sm:px-8">
          <p className="text-xs text-white/55" aria-live="polite">
            {reachedEnd ? "Thanks for reading." : "Scroll to the end to agree."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-teal-300 hover:text-teal-300"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onAgree}
              disabled={!reachedEnd}
              className="rounded-full bg-teal-400 px-5 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              I agree
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
