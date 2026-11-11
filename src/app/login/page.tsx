"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthVideoBackground } from "@/app/_components/auth-video-background";
import { BrandLogo } from "@/app/_components/brand-logo";
import { Eye, EyeOff, ShieldCheck, Users } from "@/app/_components/icons";
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

  // Safety net only: isSubmitting is deliberately left `true` after a
  // successful sign-in until the full-page navigation below unloads this
  // page. If the destination is genuinely slow to respond, recover on our
  // own after a generous window instead of freezing the button forever.
  useEffect(() => {
    if (!isSubmitting) return;
    const watchdog = setTimeout(() => {
      setIsSubmitting(false);
      setError("That's taking longer than expected. Please try again.");
    }, 12000);
    return () => clearTimeout(watchdog);
  }, [isSubmitting]);

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
      setIsSubmitting(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).single();

    // Full-page navigation on purpose, NOT router.push(). The router
    // prefetches every <Link> on this page while the user is still signed
    // out — including "/" via the logo — and the middleware answers that
    // prefetch with a redirect back to /login. router.push("/") then
    // serves that stale prefetched redirect straight from the client cache
    // with no server round trip, so it "navigates" to /login (where we
    // already are) and the page never changes: the button sat on "Signing
    // in…" until a refresh cleared the cache. A document load always asks
    // the server, which now sees the fresh session cookie.
    // replace() rather than assign() so Back doesn't land on the login form.
    // isSubmitting stays true until this page unloads, so the button keeps
    // showing "Signing in…" for exactly as long as the form is on screen.
    if (!profile || profile.status !== "approved") {
      window.location.replace("/pending-approval");
    } else if (profile.role === "admin") {
      window.location.replace("/admin");
    } else {
      window.location.replace("/");
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
      setIsSubmitting(false);
      return;
    }

    window.location.replace("/admin");
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

        <form
          onSubmit={submit}
          className="rounded-[1.5rem] border border-white/15 bg-white/10 p-8 shadow-[0_25px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl backdrop-saturate-150"
        >
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-teal-300">{mode === "staff" ? "STAFF SIGN IN" : "ADMIN SIGN IN"}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">Welcome back.</h1>

          <div className="relative mt-5 grid grid-cols-2 rounded-full border border-white/15 bg-white/5 p-1 text-sm font-semibold">
            <span
              aria-hidden="true"
              className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-br from-teal-400 to-teal-600 shadow-[0_8px_20px_rgba(45,212,191,.35)] transition-transform duration-300 ease-out ${mode === "admin" ? "translate-x-full" : "translate-x-0"}`}
            />
            <button
              type="button"
              onClick={() => switchMode("staff")}
              aria-pressed={mode === "staff"}
              className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 transition-colors duration-300 ${mode === "staff" ? "text-slate-950" : "text-white/60 hover:text-teal-200"}`}
            >
              <Users className="h-3.5 w-3.5" /> Staff
            </button>
            <button
              type="button"
              onClick={() => switchMode("admin")}
              aria-pressed={mode === "admin"}
              className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 transition-colors duration-300 ${mode === "admin" ? "text-slate-950" : "text-white/60 hover:text-teal-200"}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </button>
          </div>

          {mode === "staff" ? (
            <label key="email" className="mt-6 block animate-[rise_.3s_ease-out_both] text-sm font-semibold text-white">
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
          ) : (
            <label key="username" className="mt-6 block animate-[rise_.3s_ease-out_both] text-sm font-semibold text-white">
              Username
              <input
                required
                autoFocus
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-teal-300 focus:ring-4 focus:ring-teal-400/30"
              />
            </label>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="text-sm font-semibold text-white">
              Password
            </label>
            {mode === "staff" && (
              <Link href="/forgot-password" className="text-xs font-semibold text-teal-300 hover:text-teal-200">
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

          {error && (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {mode === "staff" && (
          <p className="mt-6 text-center text-sm text-white/70">
            New staff member?{" "}
            <Link href="/signup" className="font-semibold text-teal-300 hover:text-teal-200">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
