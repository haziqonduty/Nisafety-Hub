import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

/**
 * Browser-safe, session-aware client (uses NEXT_PUBLIC_ env vars, anon key
 * only). Use only inside "use client" components. `@supabase/ssr`'s
 * `createBrowserClient` syncs the auth session into cookies the server can
 * read, which plain `@supabase/supabase-js` `createClient` does not do.
 *
 * Reuses a single instance across the whole browser session — creating a
 * fresh client per call spins up a new GoTrueClient each time, all bound to
 * the same localStorage key, which triggers Supabase's "Multiple GoTrueClient
 * instances" warning.
 */
export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Public Supabase environment variables are missing.");
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
