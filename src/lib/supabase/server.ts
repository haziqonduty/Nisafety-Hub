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
 * session check (see src/lib/auth/session.ts), with two narrow exceptions:
 *
 * 1. The abuse-tracking `submission_attempts` and `admin_login_attempts`
 *    tables have no RLS grants for `anon` at all (not even insert), so the
 *    public `/api/submissions` and `/api/admin/login` routes also use this
 *    client for those two tables.
 * 2. `/api/submissions` also uses this client to roll back its own
 *    just-created `clients` row and `safety-documents` storage object if a
 *    later step in the same request fails (the `anon` key has no delete
 *    grant on either, by design). This only ever deletes the exact row/path
 *    IDs the same request itself produced moments earlier — never an
 *    arbitrary lookup or delete of existing data.
 *
 * Never use this client to read/write `clients`/`documents` on behalf of a
 * public caller outside these two narrow cases.
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
