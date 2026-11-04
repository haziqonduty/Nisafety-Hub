import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LogoutButton } from "@/app/_components/logout-button";
import { ThemeToggle } from "@/app/_components/theme-toggle";

// Depends on the caller's own session/profile status on every visit — must
// never be statically cached (same reasoning as the homepage's own
// `force-dynamic`, which this build was otherwise marking static).
export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.status === "approved") redirect(profile.role === "admin" ? "/admin" : "/");

  const isRejected = profile.status === "rejected";

  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-6 text-ink">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm text-center">
        <BrandLogo height={48} className="mb-8 justify-center" />

        <div className="rounded-[1.5rem] border border-line bg-surface p-8 shadow-[0_20px_50px_rgba(16,42,51,.07)]">
          <p className={`font-mono text-xs font-semibold tracking-[0.14em] ${isRejected ? "text-danger" : "text-accent"}`}>
            {isRejected ? "ACCOUNT NOT APPROVED" : "AWAITING APPROVAL"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            {isRejected ? "This account wasn't approved." : `Hang tight, ${profile.fullName || "there"}.`}
          </h1>
          <p className="mt-3 text-sm text-ink-muted">
            {isRejected
              ? "An admin has reviewed this account and it was not approved for access. Contact your administrator if you believe this is a mistake."
              : "An admin needs to approve your account before you can sign in. You'll be able to access the directory as soon as that happens."}
          </p>

          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
