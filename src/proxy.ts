import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { PROFILE_HEADER_NAME } from "@/lib/auth/profile-header";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

// Outside [locale], English-only, same as /admin — see src/app/login,
// src/app/signup, src/app/pending-approval. Reachable with no session at all
// (there's nothing to gate on a sign-in page itself). /reset-password in
// particular is always visited with no session yet — the recovery session
// it needs arrives via the URL hash from the email link, which this
// middleware never sees (hash fragments never reach the server).
const AUTH_PATHS = ["/login", "/signup", "/pending-approval", "/forgot-password", "/reset-password", "/terms"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, supabase } = await updateSession(request);

  if (AUTH_PATHS.includes(pathname)) {
    return response;
  }

  // No session at all — nothing to refresh, so no need to carry `response`'s
  // cookies onto the redirect (matches Supabase's own documented middleware
  // recipe: a redirect-to-login drops the refresh, since getUser() will just
  // redo it on whatever request comes next anyway).
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "approved") {
    return NextResponse.redirect(new URL("/pending-approval", request.url));
  }

  // Hand the profile we just fetched to the page render via a request
  // header, so getCurrentProfile() (src/lib/auth/profile.ts) can read it
  // instead of re-running the exact same auth.getUser() + profiles query a
  // second time — middleware and the page render are separate invocations,
  // so React's cache() alone can't dedupe across them.
  request.headers.set(
    PROFILE_HEADER_NAME,
    JSON.stringify({ id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role, status: profile.status }),
  );

  if (pathname.startsWith("/admin")) {
    if (profile.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // /admin stays entirely outside the i18n system, same as before — just
    // rebuilt (instead of reusing `response`) so it picks up the header set
    // above, then carries the session-refresh cookies over the same way.
    const adminResponse = NextResponse.next({ request });
    response.cookies.getAll().forEach((cookie) => adminResponse.cookies.set(cookie));
    return adminResponse;
  }

  // Public, locale-scoped tree: let next-intl resolve the locale, then carry
  // the Supabase session-refresh cookies over onto its response — both sets
  // of cookies need to survive this single pass. next-intl builds its
  // response from `new Headers(request.headers)` internally, so the header
  // set above rides along automatically.
  const intlResponse = intlMiddleware(request);
  response.cookies.getAll().forEach((cookie) => intlResponse.cookies.set(cookie));
  return intlResponse;
}

export const config = {
  // Runs on every page but skips /api, Next internals, and static/metadata
  // assets. icon-192/icon-512/apple-icon/manifest/opengraph-image are
  // code-generated routes with no dot in their pathname, so they'd otherwise
  // slip past the ".*\\..*" file-extension exclusion and get wrongly
  // rewritten/gated. robots.txt and sitemap.xml already have a dot.
  //
  // Unlike before, /admin is NOT excluded — the whole site now requires
  // login, admin included. /api is still excluded: a redirect response here
  // would break `fetch()` callers expecting JSON, so every API route keeps
  // doing its own explicit auth check instead (see src/lib/auth/profile.ts).
  matcher: ["/((?!api|_next|_vercel|icon-192|icon-512|apple-icon|manifest|opengraph-image|.*\\..*).*)"],
};
