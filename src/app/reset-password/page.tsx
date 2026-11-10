import Link from "next/link";
import { BrandLogo } from "@/app/_components/brand-logo";
import { ResetPasswordForm } from "@/app/_components/reset-password-form";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  // By the time a visitor reaches this page through the real flow, /api/auth/confirm
  // has already verified their reset token and established a session via cookies —
  // so this is a plain server-side check, no client-side race to get right.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-6 text-ink">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <BrandLogo height={48} className="mb-8 justify-center" />

        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="rounded-[1.5rem] border border-line bg-surface p-8 text-center shadow-[0_20px_50px_rgba(16,42,51,.07)]">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">LINK EXPIRED</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">This link isn&apos;t valid.</h1>
            <p className="mt-3 text-sm text-ink-muted">
              Reset links expire after a while, or may have already been used. Request a new one.
            </p>
            <Link href="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-accent hover:text-accent-hover">
              Request a new link →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
