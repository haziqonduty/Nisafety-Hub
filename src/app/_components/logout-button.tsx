"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  // Safety net for a genuinely slow /login load after a successful
  // sign-out — same pattern as src/app/login/page.tsx.
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
      // Full-page navigation, not router.push() + router.refresh(): the
      // session just ended, so nothing the client router cached for this
      // user (prefetched pages, the homepage payload) should survive — a
      // document load throws all of it away, and Back can't resurface it.
      window.location.replace("/login");
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
