"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { Eye, EyeOff } from "@/app/_components/icons";
import { ThemeToggle } from "@/app/_components/theme-toggle";
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
  const router = useRouter();

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
        // Left deliberately in its "Creating account…" state here — the
        // button only resets on an error path. Resetting it unconditionally
        // (the old behaviour) made it pop back to "Create account" the
        // instant push() was called, not when /pending-approval was
        // actually ready, which read as the click doing nothing.
        router.push("/pending-approval");
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
    <main className="relative grid min-h-screen place-items-center bg-canvas px-6 text-ink">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <BrandLogo height={48} className="mb-8 justify-center" />

        {checkEmailNotice ? (
          <div className="rounded-[1.5rem] border border-line bg-surface p-8 text-center shadow-[0_20px_50px_rgba(16,42,51,.07)]">
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">ALMOST THERE</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Check your email.</h1>
            <p className="mt-3 text-sm text-ink-muted">
              We&apos;ve sent a confirmation link to <span className="font-semibold text-ink">{email}</span>. Once confirmed, an admin still
              needs to approve your account before you can sign in.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-accent hover:text-accent-hover">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="rounded-[1.5rem] border border-line bg-surface p-8 shadow-[0_20px_50px_rgba(16,42,51,.07)]">
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">CREATE STAFF ACCOUNT</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Join Nisafety Hub.</h1>
              <p className="mt-2 text-sm text-ink-muted">An admin reviews and approves every new account before it can sign in.</p>

              <label className="mt-6 block text-sm font-semibold">
                Full name
                <input
                  required
                  autoFocus
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold">
                Password
                <div className="relative mt-2">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
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

              {error && (
                <p className="mt-4 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger" role="alert">
                  {error}
                </p>
              )}

              <label className="mt-5 flex items-start gap-2.5 text-sm text-ink-muted">
                <input
                  required
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-2 focus:ring-accent-soft"
                />
                <span>
                  I have read and agree to the{" "}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:text-accent-hover">
                    Terms &amp; Conditions
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-muted">
              Already have an account?{" "}
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
