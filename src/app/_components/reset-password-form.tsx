"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "@/app/_components/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
        setIsSubmitting(false);
        return;
      }

      await supabase.auth.signOut();
      setDone(true);
    } catch {
      setError("We could not reach the sign-in service. Please try again.");
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[1.5rem] border border-line bg-surface p-8 text-center shadow-[0_20px_50px_rgba(16,42,51,.07)]">
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">ALL SET</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Password updated.</h1>
        <p className="mt-3 text-sm text-ink-muted">Sign in with your new password.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-accent hover:text-accent-hover">
          Go to sign in →
        </Link>
      </div>
    );
  }

  return (
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
  );
}
