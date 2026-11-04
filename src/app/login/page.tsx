"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { Eye, EyeOff } from "@/app/_components/icons";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
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
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">STAFF SIGN IN</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Welcome back.</h1>

          <label className="mt-6 block text-sm font-semibold">
            Email
            <input
              required
              autoFocus
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          New staff member?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:text-accent-hover">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
