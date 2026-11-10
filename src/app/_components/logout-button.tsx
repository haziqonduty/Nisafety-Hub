"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Same watchdog as src/app/login/page.tsx: router.push() never throws or
  // resolves a promise we can await, so a slow-but-not-failed /login load
  // (cold start, network blip) after a successful sign-out previously froze
  // this button on "Signing out…" forever, recoverable only by a manual
  // refresh. Also, unlike the login form, this had no try/catch at all —
  // signOut() itself throwing left the same frozen button with no feedback.
  useEffect(() => {
    if (!isSigningOut) return;
    const watchdog = setTimeout(() => {
      setIsSigningOut(false);
      setError("That's taking longer than expected. Please try again.");
    }, 12000);
    return () => clearTimeout(watchdog);
  }, [isSigningOut]);

  async function logout() {
    setError("");
    setIsSigningOut(true);

    try {
      await createSupabaseBrowserClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setError("We could not reach the sign-in service. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={logout}
        disabled={isSigningOut}
        className="rounded-full border border-line bg-surface/70 px-4 py-2 text-sm font-medium transition-all duration-200 hover:border-accent hover:bg-surface hover:text-accent disabled:opacity-60"
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
