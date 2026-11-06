"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { Eye, EyeOff } from "@/app/_components/icons";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The reset-link email routes through Supabase's own /auth/v1/verify
  // endpoint, which then redirects back here with the recovery session
  // encoded in the URL hash. The browser client picks that up automatically
  // and fires a PASSWORD_RECOVERY auth event — there's nothing in the URL
  // itself for this page to read directly. getSession() covers the case
  // where that event already fired before this listener was attached; the
  // timeout covers a broken/expired/already-used link that never produces
  // a session at all.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });

    const timeout = setTimeout(() => setChecking(false), 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message || "We could not update your password. Please try again.");
        return;
      }

      await supabase.auth.signOut();
      setDone(true);
    } catch {
      setError("We could not reach the sign-in service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-6 text-ink">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <BrandLogo height={48} className="mb-8 justify-center" />

        {done ? (
          <div className="rounded-[1.5rem] border border-line bg-surface p-8 text-center shadow-[0_20px_50px_rgba(16,42,51,.07)]">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">ALL SET</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Password updated.</h1>
            <p className="mt-3 text-sm text-ink-muted">Sign in with your new password.</p>
            <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-accent hover:text-accent-hover">
              Go to sign in →
            </Link>
          </div>
        ) : checking ? (
          <div className="rounded-[1.5rem] border border-line bg-surface p-8 text-center shadow-[0_20px_50px_rgba(16,42,51,.07)]">
            <p className="text-sm text-ink-muted">Checking your reset link…</p>
          </div>
        ) : !ready ? (
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
        ) : (
          <form onSubmit={submit} className="rounded-[1.5rem] border border-line bg-surface p-8 shadow-[0_20px_50px_rgba(16,42,51,.07)]">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">RESET PASSWORD</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Set a new password.</h1>

            <label className="mt-6 block text-sm font-semibold">
              New password
              <div className="relative mt-2">
                <input
                  required
                  autoFocus
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 pr-11 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted transition-colors hover:text-accent"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="mt-4 block text-sm font-semibold">
              Confirm new password
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
              />
            </label>

            {error && (
              <p className="mt-4 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
