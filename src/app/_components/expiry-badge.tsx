import { Hourglass } from "@/app/_components/icons";
import { EXPIRY_STATUS_STYLES, type ExpiryStatus } from "@/lib/validity";

/**
 * Translation key + values for a report's expiry state, shared by server and
 * client components (each passes in its own translator for the "expiry"
 * namespace).
 */
export function expiryLabel(status: ExpiryStatus, daysLeft: number | null): { key: string; values?: Record<string, number> } {
  switch (status) {
    case "expired":
      return { key: "expiredAgo", values: { count: Math.abs(daysLeft ?? 0) } };
    case "expiring":
    case "upcoming":
      return { key: "expiresIn", values: { count: daysLeft ?? 0 } };
    case "valid":
      return { key: "validFor", values: { months: Math.max(1, Math.floor((daysLeft ?? 0) / 30.4)) } };
    case "renewed":
      return { key: "renewed" };
    default:
      return { key: "noExpiry" };
  }
}

/** Small status pill: "Expires in 12 days", "Expired 3 days ago", "Valid · 11 months", "Renewed". */
export function ExpiryBadge({ status, label, className = "" }: { status: ExpiryStatus; label: string; className?: string }) {
  const styles = EXPIRY_STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${styles.chip} ${className}`}>
      {status === "expired" || status === "expiring" ? (
        <span className="relative grid h-1.5 w-1.5 place-items-center">
          <span className={`absolute inset-0 rounded-full ${styles.dot} animate-[ping-soft_1.8s_ease-out_infinite]`} />
          <span className={`relative h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        </span>
      ) : (
        <Hourglass className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}
