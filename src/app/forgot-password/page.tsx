"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } finally {
      // Always show the same confirmation, whether or not the email is
      // registered — Supabase itself never reveals that either, to stop
      // someone from using this form to discover who has an account.
      setIsSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-6 text-ink">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <BrandLogo height={48} className="mb-8 justify-center" />

        {submitted ? (
          <div className="rounded-[1.5rem] border border-line bg-surface p-8 text-center shadow-[0_20px_50px_rgba(16,42,51,.07)]">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">CHECK YOUR EMAIL</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Reset link sent.</h1>
            <p className="mt-3 text-sm text-ink-muted">
              If an account exists for <span className="font-semibold text-ink">{email}</span>, we&apos;ve sent a link to reset your
              password.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-accent hover:text-accent-hover">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="rounded-[1.5rem] border border-line bg-surface p-8 shadow-[0_20px_50px_rgba(16,42,51,.07)]">
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">STAFF ACCOUNT</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Forgot your password?</h1>
              <p className="mt-2 text-sm text-ink-muted">Enter your email and we&apos;ll send you a link to reset it.</p>

              <label className="mt-6 block text-sm font-semibold">
                Email
                <input
                  required
                  autoFocus
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-muted">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-accent hover:text-accent-hover">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
