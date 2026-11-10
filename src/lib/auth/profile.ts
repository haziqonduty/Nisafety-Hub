import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { PROFILE_HEADER_NAME } from "@/lib/auth/profile-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "staff";
  status: "pending" | "approved" | "rejected";
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "staff";
  status: "pending" | "approved" | "rejected";
};

/**
 * The signed-in caller's own profile, or null if there's no session or no
 * matching row. Memoized per request (React `cache`) since this is called
 * from layouts, pages, and API routes alike — replaces `verifyAdminSession()`
 * from the old single-shared-password admin login.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const fromMiddleware = await profileFromMiddlewareHeader();
  if (fromMiddleware !== undefined) return fromMiddleware;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  const row = data as ProfileRow;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
  };
});

// `undefined` means "no header, fall back to a live Supabase lookup" — only
// set when src/proxy.ts has already resolved the profile for this request
// (API routes bypass middleware entirely and never see this header).
async function profileFromMiddlewareHeader(): Promise<CurrentProfile | null | undefined> {
  const headerList = await headers();
  const raw = headerList.get(PROFILE_HEADER_NAME);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as CurrentProfile;
    if (!parsed.id || !parsed.role || !parsed.status) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** Null unless the caller is a signed-in, approved admin. */
export async function requireAdminProfile(): Promise<CurrentProfile | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "approved") return null;
  return profile;
}

/** Null unless the caller is a signed-in, approved staff member (any role). */
export async function requireApprovedProfile(): Promise<CurrentProfile | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "approved") return null;
  return profile;
}
