"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Calendar, Mail, Notes, Pencil, Phone, Trash } from "@/app/_components/icons";
import type { AdminClient } from "@/lib/supabase/queries";

const fieldClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

function EditContact({ client, onDone }: { client: AdminClient; onDone: () => void }) {
  const [clientName, setClientName] = useState(client.clientName);
  const [telephone, setTelephone] = useState(client.telephone);
  const [email, setEmail] = useState(client.email);
  const [internalNotes, setInternalNotes] = useState(client.internalNotes ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, telephone, email, internalNotes }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "We could not save these changes.");
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3">
      <label className="text-xs font-semibold text-ink-muted">
        Client name
        <input required value={clientName} onChange={(event) => setClientName(event.target.value)} className={fieldClass} />
      </label>
      <div className="grid gap-3">
        <label className="text-xs font-semibold text-ink-muted">
          Telephone
          <input required value={telephone} onChange={(event) => setTelephone(event.target.value)} className={fieldClass} />
        </label>
        <label className="text-xs font-semibold text-ink-muted">
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Optional" className={fieldClass} />
        </label>
      </div>
      <label className="text-xs font-semibold text-ink-muted">
        Internal notes <span className="font-normal text-ink-faint">(admin-only)</span>
        <textarea
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Called to confirm renewal, follow up next month"
          className={`${fieldClass} resize-y`}
        />
      </label>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={isSaving} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60">
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onDone} className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:text-accent">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** One contact (client record) of the company, with edit and move-to-bin. */
export function ContactCard({ client, reportCount, isOnlyContact }: { client: AdminClient; reportCount: number; isOnlyContact: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function moveToBin() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/clients/${client.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("We could not move this contact to the bin. Please try again.");
        return;
      }
      // The company page disappears with its last contact.
      if (isOnlyContact) router.push("/admin");
      router.refresh();
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  const extras = [...client.additionalClientNames, ...client.additionalTelephones, ...client.additionalEmails];

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-[0_14px_34px_rgba(16,42,51,.07)]">
      {editing ? (
        <EditContact client={client} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {client.clientName.trim().slice(0, 1).toUpperCase() || "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{client.clientName}</p>
                <p className="text-xs text-ink-muted">
                  {reportCount} {reportCount === 1 ? "report" : "reports"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${client.clientName}`}
                className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-accent-soft hover:text-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label={`Move ${client.clientName} to the recycle bin`}
                className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-danger-soft hover:text-danger"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <dl className="mt-4 grid gap-2 text-xs">
            <div className="flex items-center gap-2 text-ink-muted">
              <Phone className="h-3.5 w-3.5 shrink-0 text-accent" />
              <a href={`tel:${client.telephone}`} className="font-medium text-ink hover:text-accent">
                {client.telephone}
              </a>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-ink-muted">
              <Mail className="h-3.5 w-3.5 shrink-0 text-accent" />
              {client.email ? <span className="truncate font-medium text-ink">{client.email}</span> : <span className="italic">No email</span>}
            </div>
            <div className="flex items-center gap-2 text-ink-muted">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              Added by {client.submitterName} on {client.date}
            </div>
            {extras.length > 0 && <p className="text-ink-faint">Also: {extras.join(" · ")}</p>}
          </dl>

          {client.internalNotes && (
            <div className="relative mt-4 overflow-hidden rounded-xl border border-line bg-surface-soft py-2 pl-4 pr-3.5">
              <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-amber to-amber/30" />
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber">
                <Notes className="h-3 w-3" /> Internal note
              </p>
              <p className="mt-0.5 whitespace-pre-line break-words text-xs font-medium">{client.internalNotes}</p>
            </div>
          )}

          {confirming && (
            <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs">
              <p className="text-danger">
                Move {client.clientName} and {reportCount === 1 ? "their report" : `their ${reportCount} reports`} to the recycle bin? You can restore it for 30 days.
              </p>
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={moveToBin} disabled={deleting} className="font-semibold text-danger underline disabled:opacity-60">
                  {deleting ? "Moving…" : "Move to bin"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-xs font-semibold text-danger">
              {error}
            </p>
          )}
        </>
      )}
    </article>
  );
}

/** Move-to-bin for one report row. */
export function ReportActions({ reportId, fileName }: { reportId: string; fileName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  async function moveToBin() {
    setDeleting(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/admin/documents/${reportId}`, { method: "DELETE" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span role="alert" className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
        <span className="text-danger">Move to bin?</span>
        <button type="button" onClick={moveToBin} disabled={deleting} className="font-semibold text-danger underline disabled:opacity-60">
          {deleting ? "Moving…" : "Yes"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-1">
      {failed && <span className="mr-1 text-xs font-semibold text-danger">Couldn&apos;t delete</span>}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Move ${fileName} to the recycle bin`}
        className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-danger-soft hover:text-danger"
      >
        <Trash className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
