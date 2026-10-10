import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Checks and logs an attempt against an IP-keyed abuse-tracking table
 * (`submission_attempts`, `admin_login_attempts`, ...). Logs the attempt
 * regardless of outcome, then reports whether this attempt pushed the
 * caller over the limit for the trailing window.
 */
export async function checkRateLimit(
  table: "submission_attempts" | "admin_login_attempts",
  ipAddress: string,
  windowMinutes: number,
  maxAttempts: number,
) {
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
