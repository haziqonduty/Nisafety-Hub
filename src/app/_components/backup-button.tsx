"use client";

import { useEffect, useState } from "react";
import { Check, Download } from "@/app/_components/icons";
import { shortCategoryLabel } from "@/lib/format";

type Row = Record<string, unknown>;
type Manifest = { generatedAt: string; clients: Row[]; documents: Row[]; files: { documentId: string; url: string | null }[] };

const LAST_BACKUP_KEY = "nisafety:last-full-backup";
const REMIND_AFTER_DAYS = 30;
const PARALLEL_DOWNLOADS = 4;

function readLastBackup() {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

function daysSinceBackup() {
  const last = readLastBackup();
  return last ? Math.floor((Date.now() - Date.parse(last)) / 86_400_000) : null;
}

function safeName(value: unknown, fallback: string) {
  const cleaned = String(value ?? "")
    // Characters Windows/macOS don't allow in file names, and control characters.
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  return cleaned || fallback;
}

function malaysiaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(date);
}

/**
 * "Download full backup": builds one ZIP in the browser with an Excel sheet
 * of every client and report, the raw data as JSON (enough to restore
 * from), and every report file in a folder per client.
 */
export function BackupButton() {
  const [phase, setPhase] = useState<"idle" | "preparing" | "downloading" | "zipping" | "done" | "error">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [daysSince, setDaysSince] = useState<number | null>(null);

  useEffect(() => {
    // Browser-only storage, read after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDaysSince(daysSinceBackup());
  }, []);

  const overdue = daysSince === null || daysSince >= REMIND_AFTER_DAYS;
  const busy = phase === "preparing" || phase === "downloading" || phase === "zipping";

  async function run() {
    setPhase("preparing");
    setMessage("");
    setProgress({ done: 0, total: 0 });
    try {
      const [manifestResponse, excelResponse] = await Promise.all([fetch("/api/admin/backup", { cache: "no-store" }), fetch("/api/admin/clients/export", { cache: "no-store" })]);
      if (!manifestResponse.ok) throw new Error("We couldn't read the records.");
      const manifest = (await manifestResponse.json()) as Manifest;
      const { zipSync, strToU8 } = await import("fflate");

      const root = `Nisafety-backup-${malaysiaDate()}`;
      const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
      const usedPaths = new Set<string>();
      const uniquePath = (path: string) => {
        if (!usedPaths.has(path)) {
          usedPaths.add(path);
          return path;
        }
        const dot = path.lastIndexOf(".");
        for (let n = 2; ; n++) {
          const candidate = dot > path.lastIndexOf("/") ? `${path.slice(0, dot)} (${n})${path.slice(dot)}` : `${path} (${n})`;
          if (!usedPaths.has(candidate)) {
            usedPaths.add(candidate);
            return candidate;
          }
        }
      };

      const clientsById = new Map(manifest.clients.map((client) => [client.id as string, client]));
      const urlById = new Map(manifest.files.map((file) => [file.documentId, file.url]));
      const missing: string[] = [];

      setPhase("downloading");
      setProgress({ done: 0, total: manifest.documents.length });
      let next = 0;
      let finished = 0;
      async function worker() {
        while (next < manifest.documents.length) {
          const document = manifest.documents[next++];
          const client = clientsById.get(document.client_id as string);
          const folder = safeName(client?.company_name, "Unknown organisation");
          const fileName = `${safeName(document.service_date, "undated")} ${safeName(shortCategoryLabel(String(document.category ?? "")), "Report")} - ${safeName(document.file_name, "report")}`;
          const path = uniquePath(`${root}/reports/${folder}/${fileName}`);
          const url = urlById.get(document.id as string);
          try {
            if (!url) throw new Error("no link");
            const response = await fetch(url);
            if (!response.ok) throw new Error(String(response.status));
            // Reports are already compressed (PDF/DOCX): store them as-is, fast.
            entries[path] = [new Uint8Array(await response.arrayBuffer()), { level: 0 }];
          } catch {
            missing.push(`${client?.company_name ?? "Unknown"} — ${document.file_name}`);
          }
          finished += 1;
          setProgress({ done: finished, total: manifest.documents.length });
        }
      }
      await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));

      setPhase("zipping");
      if (excelResponse.ok) entries[`${root}/clients-and-reports.xlsx`] = [new Uint8Array(await excelResponse.arrayBuffer()), { level: 0 }];
      entries[`${root}/data/clients.json`] = strToU8(JSON.stringify(manifest.clients, null, 2));
      entries[`${root}/data/documents.json`] = strToU8(JSON.stringify(manifest.documents, null, 2));
      entries[`${root}/README.txt`] = strToU8(
        [
          "NISAFETY HUB — FULL BACKUP",
          `Created: ${new Date(manifest.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })} (Malaysia time)`,
          "",
          `Clients: ${manifest.clients.length}`,
          `Reports: ${manifest.documents.length} (${manifest.documents.length - missing.length} files included)`,
          "",
          "What's inside:",
          "  clients-and-reports.xlsx  Every client and report, for reading in Excel.",
          "  reports/<company>/         Every report file, named <date of monitoring> <service> - <file name>.",
          "  data/clients.json          Raw database rows (all fields) — used to restore the system.",
          "  data/documents.json        Raw database rows for every report, incl. dates and expiry.",
          "",
          "Keep this ZIP somewhere safe and private (company computer or company Google Drive):",
          "it contains client contact details and internal notes.",
          "Items in the recycle bin are not included.",
          ...(missing.length ? ["", `WARNING: ${missing.length} file(s) could not be downloaded:`, ...missing.map((item) => `  - ${item}`)] : []),
          "",
        ].join("\r\n"),
      );

      const zipped = zipSync(entries, { level: 6 });
      const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
      const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${root}.zip` });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);

      try {
        window.localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      } catch {
        // Private window etc. — the reminder just won't remember.
      }
      setDaysSince(0);
      setPhase("done");
      const size = blob.size < 1024 * 1024 ? `${Math.max(1, Math.round(blob.size / 1024))} KB` : `${(blob.size / (1024 * 1024)).toFixed(1)} MB`;
      setMessage(
        missing.length
          ? `Backup downloaded (${size}), but ${missing.length} file(s) couldn't be fetched — they're listed in README.txt. Try again later.`
          : `Backup downloaded (${size}): ${manifest.clients.length} clients, ${manifest.documents.length} reports. Keep it somewhere safe.`,
      );
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error && error.message ? `${error.message} Please try again.` : "The backup didn't finish. Please try again.");
    }
  }

  const label =
    phase === "preparing"
      ? "Preparing…"
      : phase === "downloading"
        ? `Downloading ${progress.done} of ${progress.total} files…`
        : phase === "zipping"
          ? "Creating ZIP…"
          : "Download full backup";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:translate-y-0 disabled:cursor-wait"
      >
        {busy && progress.total > 0 && (
          <span aria-hidden className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        )}
        <span className="relative inline-flex items-center gap-2">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden /> : phase === "done" ? <Check className="h-4 w-4 text-accent" /> : <Download className="h-4 w-4" />}
          {label}
        </span>
      </button>
      <p className={`text-xs ${overdue && !busy ? "text-amber" : "text-ink-faint"}`} aria-live="polite">
        {daysSince === null
          ? "No full backup downloaded on this computer yet."
          : daysSince === 0
            ? "Last full backup: today."
            : `Last full backup: ${daysSince} ${daysSince === 1 ? "day" : "days"} ago${overdue ? " — time for a new one." : "."}`}
      </p>
      {message && (
        <p role={phase === "error" ? "alert" : "status"} className={`max-w-xs text-right text-xs ${phase === "error" ? "text-danger" : "text-ink-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
