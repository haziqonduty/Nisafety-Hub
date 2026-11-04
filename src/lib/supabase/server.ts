import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Session-aware client for Server Components and Route Handlers — reads the
 * caller's Supabase Auth session from cookies, so RLS policies keyed off
 * `auth.uid()` apply as that specific user (used for every read/write that
 * should be scoped to "the signed-in, approved staff member making this
 * request", replacing the old anon-key reads now that anon has no grants).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Public Supabase environment variables are missing.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render, where cookies can't be
          // written — middleware's own session refresh covers this case.
        }
      },
    },
  });
}

/**
 * Bypasses Row Level Security. Call this only after an explicit admin check
 * (see src/lib/auth/profile.ts's `requireAdminProfile()`), with a few narrow,
 * pre-existing exceptions still needed even for an authenticated caller:
 *
 * 1. The abuse-tracking `submission_attempts` and `admin_login_attempts`
 *    tables have no RLS grants for any role at all (not even insert), so
 *    rate-limit checks always go through this client.
 * 2. `/api/submissions` uses this client to roll back its own just-created
 *    `clients` row and `safety-documents` storage object if a later step in
 *    the same request fails. This only ever deletes the exact row/path IDs
 *    the same request itself produced moments earlier — never an arbitrary
 *    lookup or delete of existing data.
 * 3. `/api/admin/staff/[id]` uses this client to approve/reject/promote a
 *    staff account — `profiles` RLS only lets an admin update *other* rows
 *    via policy, but staying on the service client here keeps the pattern
 *    consistent with every other admin mutation in this codebase.
 *
 * Never use this client to read/write `clients`/`documents` on behalf of a
 * caller outside these narrow cases — use `createSupabaseServerClient()`
 * instead, so RLS applies as that specific signed-in user.
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
