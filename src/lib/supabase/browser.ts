import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

/**
 * Browser-safe client (uses NEXT_PUBLIC_ env vars). Only the anon/publishable
 * key, never the service role key. Use only inside "use client" components.
 *
 * Reuses a single instance across the whole browser session — creating a
 * fresh client per call spins up a new GoTrueClient each time, all bound to
 * the same localStorage key, which triggers Supabase's "Multiple GoTrueClient
 * instances" warning. We don't use any `supabase.auth.*` features (admin
 * login is a separate custom session, not Supabase Auth), so it was never a
 * functional bug — just avoidable noise.
 */
export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Public Supabase environment variables are missing.");
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
