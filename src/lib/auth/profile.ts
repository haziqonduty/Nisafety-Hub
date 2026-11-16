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
 * The signed-in caller's profile for DISPLAY in page renders (greeting, role
 * chip, which links to show). Reuses the profile src/proxy.ts already looked
 * up, via a request header, to save a round trip.
 *
 * SECURITY: never use this to authorize anything. A request that doesn't go
 * through the proxy (every /api route, and paths the matcher skips) can carry
 * a forged copy of that header. Use requireAdminProfile() /
 * requireApprovedProfile() / getVerifiedProfile(), which always check the
 * real Supabase session.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const fromMiddleware = await profileFromMiddlewareHeader();
  if (fromMiddleware !== undefined) return fromMiddleware;
  return getVerifiedProfile();
});

/**
 * The caller's profile, looked up from their real Supabase session (cookie
 * → auth.getUser() → profiles row). Never reads request headers. Memoized
 * per request.
 */
export const getVerifiedProfile = cache(async (): Promise<CurrentProfile | null> => {
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

// `undefined` means "no header, fall back to a live Supabase lookup". The
// proxy strips any incoming copy and sets its own, but routes it doesn't run
// on (all of /api) receive whatever the client sent — display only.
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
  const profile = await getVerifiedProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "approved") return null;
  return profile;
}

/** Null unless the caller is a signed-in, approved staff member (any role). */
export async function requireApprovedProfile(): Promise<CurrentProfile | null> {
  const profile = await getVerifiedProfile();
  if (!profile || profile.status !== "approved") return null;
  return profile;
}
