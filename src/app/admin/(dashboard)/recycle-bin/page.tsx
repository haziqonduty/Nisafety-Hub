import { redirect } from "next/navigation";
import { RecycleBinList } from "@/app/_components/recycle-bin-list";
import { requireAdminProfile } from "@/lib/auth/profile";
import { purgeBin, RECYCLE_BIN_DAYS } from "@/lib/supabase/admin-mutations";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getRecycleBin } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function RecycleBinPage() {
  // Layouts and pages render in parallel, so don't rely on the admin
  // layout's check before doing the clean-up below.
  if (!(await requireAdminProfile())) redirect("/login");

  // No scheduled job on the free plan: anything past its 30 days is
  // permanently removed whenever an admin opens the bin. Until then it's
  // already hidden from staff everywhere, so the timing doesn't matter.
  await purgeBin(createSupabaseServiceClient());
  const items = await getRecycleBin(RECYCLE_BIN_DAYS);

  return (
    <section className="py-8">
      <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">RECYCLE BIN</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Deleted clients &amp; reports.</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-muted">
        Anything deleted stays here for {RECYCLE_BIN_DAYS} days, hidden from staff. Restore it to put it back exactly as it was; after {RECYCLE_BIN_DAYS} days it&apos;s permanently removed, files included.
      </p>
      <RecycleBinList items={items} retentionDays={RECYCLE_BIN_DAYS} />
    </section>
  );
}
