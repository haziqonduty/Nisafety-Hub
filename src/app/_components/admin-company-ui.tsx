import type { CompanyStatus } from "@/lib/admin-companies";
import { shortCategoryLabel } from "@/lib/format";

/** Shared look for the admin company list and company page. Server- and client-safe. */
const STATUS: Record<CompanyStatus, { label: string; chip: string; dot: string; bar: string }> = {
  expired: { label: "Expired", chip: "bg-danger-soft text-danger", dot: "bg-danger", bar: "bg-danger" },
  expiring: { label: "Expiring soon", chip: "bg-amber-soft text-amber", dot: "bg-amber", bar: "bg-amber" },
  upcoming: { label: "Due in 90 days", chip: "bg-badge-neutral-bg text-badge-neutral-text", dot: "bg-amber/70", bar: "bg-amber/60" },
  valid: { label: "All valid", chip: "bg-accent-soft text-accent", dot: "bg-accent", bar: "bg-accent" },
  none: { label: "No expiry tracked", chip: "bg-badge-neutral-bg text-badge-neutral-text", dot: "bg-ink-faint", bar: "bg-line" },
  no_report: { label: "No report yet", chip: "bg-badge-neutral-bg text-badge-neutral-text", dot: "bg-ink-faint", bar: "bg-line" },
};

export function companyStatusStyle(status: CompanyStatus) {
  return STATUS[status];
}

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const style = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

/** Two-letter monogram from the company name, skipping "SDN", "BHD" and the like. */
export function companyMonogram(name: string) {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !["SDN", "BHD", "M", "THE", "AND", "PLT", "ENTERPRISE"].includes(word));
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).trim() || "?";
}

export function CompanyMonogram({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center bg-gradient-to-br from-accent to-brand font-semibold tracking-[-0.02em] text-white shadow-[0_8px_18px_rgba(15,118,110,.22)] ${
        size === "lg" ? "h-16 w-16 rounded-2xl text-xl" : "h-11 w-11 rounded-xl text-sm"
      }`}
    >
      {companyMonogram(name)}
    </span>
  );
}

export function ServiceCode({ category, muted = false }: { category: string; muted?: boolean }) {
  return (
    <span
      title={category}
      className={`inline-flex max-w-[14rem] items-center truncate rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
        muted ? "border border-dashed border-line text-ink-muted" : "bg-surface-soft text-ink"
      }`}
    >
      {shortCategoryLabel(category)}
    </span>
  );
}
