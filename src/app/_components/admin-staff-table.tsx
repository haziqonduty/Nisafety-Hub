"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar, Mail } from "@/app/_components/icons";
import type { AdminProfile } from "@/lib/supabase/queries";

function initialsFor(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

const STATUS_BADGE: Record<AdminProfile["status"], string> = {
  pending: "bg-amber-soft text-amber",
  approved: "bg-accent-soft text-accent",
  rejected: "bg-danger-soft text-danger",
};

const STATUS_LABEL: Record<AdminProfile["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Not approved",
};

function StaffCard({ profile, isSelf }: { profile: AdminProfile; isSelf: boolean }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function patch(body: { status?: string; role?: string }) {
    setError("");
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/staff/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "We could not update this account.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="group overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-soft hover:shadow-[0_18px_38px_rgba(16,42,51,.09)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-brand text-base font-bold text-white shadow-[0_6px_14px_rgba(15,118,110,.25)]">
            {initialsFor(profile.fullName || profile.email)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {profile.fullName || "(no name provided)"} {isSelf && <span className="text-ink-faint">(you)</span>}
              <span className="ml-2 inline-flex items-center rounded-full bg-badge-neutral-bg px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-badge-neutral-text">
                {profile.role}
              </span>
              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE[profile.status]}`}>
                {STATUS_LABEL[profile.status]}
              </span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-accent" />
                {profile.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-ink-faint" />
                Requested {profile.date}
              </span>
            </div>
            {error && (
              <p className="mt-2 text-xs text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        {!isSelf && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {profile.status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => patch({ status: "approved" })}
                  disabled={isUpdating}
                  className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => patch({ status: "rejected" })}
                  disabled={isUpdating}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-danger hover:bg-danger-soft hover:text-danger disabled:opacity-60"
                >
                  Reject
                </button>
              </>
            )}
            {profile.status === "approved" && (
              <>
                <button
                  type="button"
                  onClick={() => patch({ role: profile.role === "admin" ? "staff" : "admin" })}
                  disabled={isUpdating}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent disabled:opacity-60"
                >
                  {profile.role === "admin" ? "Make staff" : "Make admin"}
                </button>
                <button
                  type="button"
                  onClick={() => patch({ status: "rejected" })}
                  disabled={isUpdating}
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-danger hover:bg-danger-soft hover:text-danger disabled:opacity-60"
                >
                  Revoke access
                </button>
              </>
            )}
            {profile.status === "rejected" && (
              <button
                type="button"
                onClick={() => patch({ status: "approved" })}
                disabled={isUpdating}
                className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
              >
                Approve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminStaffTable({ profiles, currentProfileId }: { profiles: AdminProfile[]; currentProfileId: string }) {
  if (profiles.length === 0) {
    return <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">No staff accounts yet.</div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {profiles.map((profile) => (
        <StaffCard key={profile.id} profile={profile} isSelf={profile.id === currentProfileId} />
      ))}
    </div>
  );
}
