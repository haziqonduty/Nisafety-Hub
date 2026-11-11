"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthVideoBackground } from "@/app/_components/auth-video-background";
import { BrandLogo } from "@/app/_components/brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      // No redirectTo here — the Supabase dashboard's "Reset Password" email
      // template builds its own link straight to /api/auth/confirm (see that
      // route for why), so this call only needs to know who to email.
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.resetPasswordForEmail(email);
    } finally {
      // Always show the same confirmation, whether or not the email is
      // registered — Supabase itself never reveals that either, to stop
      // someone from using this form to discover who has an account.
      setIsSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-6 text-white">
      <AuthVideoBackground paused={isSubmitting} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLogo height={48} className="justify-center drop-shadow-[0_4px_18px_rgba(0,0,0,0.7)]" />
        </div>

        {submitted ? (
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-8 text-center shadow-[0_25px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl backdrop-saturate-150">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-teal-300">CHECK YOUR EMAIL</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">Reset link sent.</h1>
            <p className="mt-3 text-sm text-white/70">
              If an account exists for <span className="font-semibold text-white">{email}</span>, we&apos;ve sent a link to reset your
              password.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-teal-300 hover:text-teal-200">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form
              onSubmit={submit}
              className="rounded-[1.5rem] border border-white/15 bg-white/10 p-8 shadow-[0_25px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl backdrop-saturate-150"
            >
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-teal-300">STAFF ACCOUNT</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">Forgot your password?</h1>
              <p className="mt-2 text-sm text-white/70">Enter your email and we&apos;ll send you a link to reset it.</p>

              <label className="mt-6 block text-sm font-semibold text-white">
                Email
                <input
                  required
                  autoFocus
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-teal-300 focus:ring-4 focus:ring-teal-400/30"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-white/70">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-teal-300 hover:text-teal-200">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
