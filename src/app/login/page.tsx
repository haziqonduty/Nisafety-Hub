"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { Eye, EyeOff, ShieldCheck, Users } from "@/app/_components/icons";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "staff" | "admin";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("staff");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // A password-reset email link should always land on /reset-password, but
  // if it's ever misrouted here instead (e.g. Supabase's Redirect URL
  // allow-list doesn't have the exact domain it was requested from yet, so
  // Supabase falls back to the bare Site URL, which this app's auth gate
  // then bounces straight to /login) the recovery session is still sitting
  // in the URL hash — forward it on to /reset-password instead of leaving
  // the visitor stuck looking at an ordinary sign-in form. Runs once on
  // mount; the brief instant the form is visible first in that rare case is
  // a better trade-off than adding a loading gate that delays every normal
  // sign-in just to cover this edge case.
  useEffect(() => {
    if (window.location.hash.includes("type=recovery") && window.location.hash.includes("access_token")) {
      router.replace(`/reset-password${window.location.hash}`);
    }
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
  }

  async function submitStaff() {
    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !data.user) {
      setError("Incorrect email or password.");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).single();

    router.refresh();
    if (!profile || profile.status !== "approved") {
      router.push("/pending-approval");
    } else if (profile.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/");
    }
  }

  async function submitAdmin() {
    const response = await fetch("/api/admin/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setError("Incorrect username or password.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "staff") await submitStaff();
      else await submitAdmin();
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

        <form onSubmit={submit} className="rounded-[1.5rem] border border-line bg-surface p-8 shadow-[0_20px_50px_rgba(16,42,51,.07)]">
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">{mode === "staff" ? "STAFF SIGN IN" : "ADMIN SIGN IN"}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Welcome back.</h1>

          <div className="relative mt-5 grid grid-cols-2 rounded-full border border-line bg-surface-soft p-1 text-sm font-semibold">
            <span
              aria-hidden="true"
              className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-br from-accent to-brand shadow-[0_8px_20px_rgba(15,118,110,.35)] transition-transform duration-300 ease-out ${mode === "admin" ? "translate-x-full" : "translate-x-0"}`}
            />
            <button
              type="button"
              onClick={() => switchMode("staff")}
              aria-pressed={mode === "staff"}
              className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 transition-colors duration-300 ${mode === "staff" ? "text-white" : "text-ink-muted hover:text-accent"}`}
            >
              <Users className="h-3.5 w-3.5" /> Staff
            </button>
            <button
              type="button"
              onClick={() => switchMode("admin")}
              aria-pressed={mode === "admin"}
              className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 transition-colors duration-300 ${mode === "admin" ? "text-white" : "text-ink-muted hover:text-accent"}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </button>
          </div>

          {mode === "staff" ? (
            <label key="email" className="mt-6 block animate-[rise_.3s_ease-out_both] text-sm font-semibold">
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
          ) : (
            <label key="username" className="mt-6 block animate-[rise_.3s_ease-out_both] text-sm font-semibold">
              Username
              <input
                required
                autoFocus
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
              />
            </label>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="text-sm font-semibold">
              Password
            </label>
            {mode === "staff" && (
              <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:text-accent-hover">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative mt-2">
            <input
              id="login-password"
              required
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {mode === "staff" && (
          <p className="mt-6 text-center text-sm text-ink-muted">
            New staff member?{" "}
            <Link href="/signup" className="font-semibold text-accent hover:text-accent-hover">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
