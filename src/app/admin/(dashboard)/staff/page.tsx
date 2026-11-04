import { AdminStaffTable } from "@/app/_components/admin-staff-table";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getAllProfiles } from "@/lib/supabase/queries";

export default async function AdminStaffPage() {
  const [profiles, currentProfile] = await Promise.all([getAllProfiles(), getCurrentProfile()]);
  const pendingCount = profiles.filter((profile) => profile.status === "pending").length;

  return (
    <div className="py-8">
      <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">STAFF ACCESS</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Manage staff</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {pendingCount > 0
          ? `${pendingCount} account${pendingCount === 1 ? "" : "s"} waiting on your approval.`
          : "Everyone who's signed up has been reviewed."}
      </p>

      <AdminStaffTable profiles={profiles} currentProfileId={currentProfile?.id ?? ""} />
    </div>
  );
}
