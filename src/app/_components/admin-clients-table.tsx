"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Calendar, Mail, Pencil, Phone, Search, Trash } from "@/app/_components/icons";
import { toneBadgeClass, toneForCategory } from "@/lib/format";
import type { AdminClient } from "@/lib/supabase/queries";

const fieldClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

function initialsFor(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function EditRow({ client, onDone }: { client: AdminClient; onDone: () => void }) {
  const [clientName, setClientName] = useState(client.clientName);
  const [telephone, setTelephone] = useState(client.telephone);
  const [email, setEmail] = useState(client.email);
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
        body: JSON.stringify({ clientName, telephone, email }),
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
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-accent-soft bg-accent-soft/40 p-4 sm:grid-cols-3">
      <label className="text-xs font-semibold text-ink-muted">
        Client name
        <input required value={clientName} onChange={(event) => setClientName(event.target.value)} className={fieldClass} />
      </label>
      <label className="text-xs font-semibold text-ink-muted">
        Telephone
        <input required value={telephone} onChange={(event) => setTelephone(event.target.value)} className={fieldClass} />
      </label>
      <label className="text-xs font-semibold text-ink-muted">
        Email
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
      </label>
      {error && <p className="sm:col-span-3 text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2 sm:col-span-3">
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

function DocumentChip({ document }: { document: AdminClient["documents"][number] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide ${toneBadgeClass(toneForCategory(document.category))}`}>
      {document.category}
    </span>
  );
}

function ClientCard({ client }: { client: AdminClient }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function confirmDeleteClient() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/clients/${client.id}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="group overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-soft hover:shadow-[0_18px_38px_rgba(16,42,51,.09)]">
      {editing ? (
        <EditRow client={client} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-brand text-base font-bold text-white shadow-[0_6px_14px_rgba(15,118,110,.25)]">
              {initialsFor(client.clientName)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {client.clientName} <span className="text-ink-faint">·</span> <span className="text-ink-muted">{client.companyName}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-accent" />{client.telephone}</span>
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-accent" />{client.email}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-ink-faint" />Submitted by {client.submitterName} on {client.date}</span>
              </div>
              {client.documents.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {client.documents.map((document) => (
                    <DocumentChip key={document.id} document={document} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {confirmingDelete ? (
              <span role="alert" className="inline-flex items-center gap-1.5 rounded-full border border-danger-soft bg-danger-soft px-3 py-2 text-xs">
                <span className="text-danger">Delete this client and all its documents?</span>
                <button type="button" onClick={confirmDeleteClient} disabled={isDeleting} className="font-semibold text-danger underline disabled:opacity-60">
                  {isDeleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="text-ink-muted hover:text-ink">
                  Cancel
                </button>
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink transition hover:border-accent hover:bg-accent-soft hover:text-accent"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-danger hover:bg-danger-soft hover:text-danger"
                >
                  <Trash className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminClientsTable({ clients }: { clients: AdminClient[] }) {
  const [query, setQuery] = useState("");

  const filteredClients = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    if (!normalisedQuery) return clients;
    return clients.filter((client) => {
      const documentText = client.documents.map((document) => `${document.category} ${document.fileName}`).join(" ");
      return `${client.clientName} ${client.companyName} ${client.email} ${client.telephone} ${documentText}`.toLowerCase().includes(normalisedQuery);
    });
  }, [clients, query]);

  return (
    <>
      <label className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-shadow focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
        <Search className="h-4 w-4 text-accent" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
          placeholder="Search by client, company, email, phone, or document"
          aria-label="Search clients"
        />
      </label>

      {clients.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">No client records have been submitted yet.</div>
      ) : filteredClients.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">No clients match that search.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </>
  );
}
