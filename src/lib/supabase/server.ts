import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Bypasses Row Level Security. Call this only after an explicit admin
 * session check (see src/lib/auth/session.ts), with one narrow exception:
 * the abuse-tracking `submission_attempts` and `admin_login_attempts`
 * tables have no RLS grants for `anon` at all (not even insert), so the
 * public `/api/submissions` and `/api/admin/login` routes also use this
 * client for those two tables — never for `clients`/`documents` or any
 * other user-facing data from a public route.
 */
export function createSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role environment variables are missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
