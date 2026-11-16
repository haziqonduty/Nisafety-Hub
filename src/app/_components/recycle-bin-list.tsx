"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { File, RefreshCw, Trash, Users } from "@/app/_components/icons";
import type { RecycleBinItem } from "@/lib/supabase/queries";

function deletedOn(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
}

async function binAction(body: Record<string, string>) {
  const response = await fetch("/api/admin/recycle-bin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return response.ok ? null : (result.error ?? "Something went wrong. Please try again.");
}

export function RecycleBinList({ items, retentionDays }: { items: RecycleBinItem[]; retentionDays: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(key: string, body: Record<string, string>, success: string) {
    setBusy(key);
    setError("");
    setNotice("");
    const failure = await binAction(body);
    setBusy(null);
    setConfirming(null);
    if (failure) {
      setError(failure);
      return;
    }
    setNotice(success);
    router.refresh();
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink tabular-nums">{items.length}</span> {items.length === 1 ? "item" : "items"} in the bin
        </p>
        {items.length > 0 &&
          (confirming === "empty" ? (
            <span role="alert" className="inline-flex flex-wrap items-center gap-2 rounded-full border border-danger-soft bg-danger-soft px-3 py-2 text-xs">
              <span className="text-danger">Permanently delete everything in the bin, files included?</span>
              <button type="button" disabled={busy !== null} onClick={() => run("empty", { action: "empty" }, "The recycle bin is empty.")} className="font-semibold text-danger underline disabled:opacity-60">
                {busy === "empty" ? "Deleting…" : "Yes, empty it"}
              </button>
              <button type="button" onClick={() => setConfirming(null)} className="text-ink-muted hover:text-ink">
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming("empty")} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-danger hover:text-danger">
              <Trash className="h-3.5 w-3.5" /> Empty bin
            </button>
          ))}
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent animate-[rise_.3s_ease-out_both]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-line px-6 py-14 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
            <Trash className="h-5 w-5" />
          </span>
          <p className="mt-4 font-semibold">The recycle bin is empty.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Deleted clients and reports appear here for {retentionDays} days, so a mistake can always be undone.</p>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3">
          {items.map((item) => {
            const key = `${item.kind}:${item.id}`;
            const Icon = item.kind === "client" ? Users : File;
            const urgent = item.daysLeft <= 3;
            return (
              <li key={key} className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-soft text-ink-muted">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                      <span className="rounded-md bg-badge-neutral-bg px-1.5 py-0.5 font-mono text-[10px] font-bold text-badge-neutral-text">
                        {item.kind === "client" ? `CLIENT · ${item.reportCount} ${item.reportCount === 1 ? "REPORT" : "REPORTS"}` : "REPORT"}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">{item.subtitle}</p>
                    <p className="mt-1.5 text-xs text-ink-faint">
                      Deleted {deletedOn(item.deletedAt)}
                      {item.deletedBy ? ` by ${item.deletedBy}` : ""} ·{" "}
                      <span className={urgent ? "font-semibold text-danger" : ""}>
                        {item.daysLeft === 0 ? "removed permanently today" : `removed permanently in ${item.daysLeft} ${item.daysLeft === 1 ? "day" : "days"}`}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {confirming === key ? (
                    <span role="alert" className="inline-flex flex-wrap items-center gap-2 rounded-full border border-danger-soft bg-danger-soft px-3 py-2 text-xs">
                      <span className="text-danger">Delete forever? This can&apos;t be undone.</span>
                      <button type="button" disabled={busy !== null} onClick={() => run(key, { action: "purge", kind: item.kind, id: item.id }, `“${item.title}” was permanently deleted.`)} className="font-semibold text-danger underline disabled:opacity-60">
                        {busy === key ? "Deleting…" : "Delete forever"}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="text-ink-muted hover:text-ink">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => run(key, { action: "restore", kind: item.kind, id: item.id }, `“${item.title}” was restored.`)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,42,51,.15)] transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:translate-y-0 disabled:opacity-60"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> {busy === key ? "Restoring…" : "Restore"}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setConfirming(key)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-danger hover:text-danger disabled:opacity-60"
                      >
                        <Trash className="h-3.5 w-3.5" /> Delete forever
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
