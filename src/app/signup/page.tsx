"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthVideoBackground } from "@/app/_components/auth-video-background";
import { BrandLogo } from "@/app/_components/brand-logo";
import { Eye, EyeOff } from "@/app/_components/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkEmailNotice, setCheckEmailNotice] = useState(false);

  // Safety net for a genuinely slow destination — see the matching watchdog
  // in src/app/login/page.tsx.
  useEffect(() => {
    if (!isSubmitting) return;
    const watchdog = setTimeout(() => {
      setIsSubmitting(false);
      setError("That's taking longer than expected. Please try again.");
    }, 12000);
    return () => clearTimeout(watchdog);
  }, [isSubmitting]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (signUpError) {
        setError(signUpError.message || "We could not create your account. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Supabase returns a session immediately only if email confirmation is
      // off for this project; otherwise there's a confirmation email to send
      // first. Both outcomes lead to the same place (waiting for admin
      // approval), just with a different first step.
      if (data.session) {
        // Full-page navigation, not router.push(): the session just changed,
        // and anything the router prefetched on this page was fetched while
        // signed out — see the sign-in handler in src/app/login/page.tsx.
        // The button stays on "Creating account…" until this page unloads.
        window.location.replace("/pending-approval");
      } else {
        setCheckEmailNotice(true);
        setIsSubmitting(false);
      }
    } catch {
      setError("We could not reach the sign-up service. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-6 text-white">
      <AuthVideoBackground paused={isSubmitting} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLogo height={48} className="justify-center drop-shadow-[0_4px_18px_rgba(0,0,0,0.7)]" />
        </div>

        {checkEmailNotice ? (
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-8 text-center shadow-[0_25px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl backdrop-saturate-150">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-teal-300">ALMOST THERE</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">Check your email.</h1>
            <p className="mt-3 text-sm text-white/70">
              We&apos;ve sent a confirmation link to <span className="font-semibold text-white">{email}</span>. Once confirmed, an admin still
              needs to approve your account before you can sign in.
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
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-teal-300">CREATE STAFF ACCOUNT</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">Join Nisafety Hub.</h1>
              <p className="mt-2 text-sm text-white/70">An admin reviews and approves every new account before it can sign in.</p>

              <label className="mt-6 block text-sm font-semibold text-white">
                Full name
                <input
                  required
                  autoFocus
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-teal-300 focus:ring-4 focus:ring-teal-400/30"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold text-white">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-teal-300 focus:ring-4 focus:ring-teal-400/30"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold text-white">
                Password
                <div className="relative mt-2">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 pr-11 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-teal-300 focus:ring-4 focus:ring-teal-400/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-white/50 transition-colors hover:text-teal-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {error && (
                <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
                  {error}
                </p>
              )}

              <label className="mt-5 flex items-start gap-2.5 text-sm text-white/70">
                <input
                  required
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 text-teal-400 focus:ring-2 focus:ring-teal-400/30"
                />
                <span>
                  I have read and agree to the{" "}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-300 hover:text-teal-200">
                    Terms &amp; Conditions
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-white/70">
              Already have an account?{" "}
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
