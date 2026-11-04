import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Checks and logs an attempt against the IP-keyed `submission_attempts`
 * abuse-tracking table. Logs the attempt regardless of outcome, then reports
 * whether this attempt pushed the caller over the limit for the trailing
 * window. (The old admin-login variant of this, `admin_login_attempts`, has
 * no caller anymore — admin sign-in now goes through Supabase Auth, which
 * has its own built-in rate limiting.)
 */
export async function checkRateLimit(table: "submission_attempts", ipAddress: string, windowMinutes: number, maxAttempts: number) {
  const client = createSupabaseServiceClient();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= maxAttempts) {
    return { limited: true as const };
  }

  await client.from(table).insert({ ip_address: ipAddress });
  return { limited: false as const };
}
