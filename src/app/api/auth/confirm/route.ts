import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Entry point for the password-reset email link. Supabase's default
// {{ .ConfirmationURL }} template hands the session back via the URL hash
// fragment, picked up by the browser's own Supabase client — but
// @supabase/ssr's createBrowserClient always runs in "pkce" flow mode,
// which explicitly REJECTS that hash-based (implicit-flow) callback rather
// than accepting it (confirmed directly against the real auth-js source:
// GoTrueClient._getSessionFromURL() throws AuthPKCEGrantCodeExchangeError
// whenever an implicit-style callback reaches a pkce-flow client). That
// made /reset-password's recovery link permanently fail, every time, not
// just as a rare race.
//
// This route is the fix: the Supabase dashboard's "Reset Password" email
// template is configured to link here with {{ .TokenHash }} as a normal,
// server-visible query parameter instead of {{ .ConfirmationURL }}. That
// token is verified server-side with verifyOtp(), which establishes a real
// session via cookies before the browser ever reaches /reset-password —
// no client-side hash detection, and no PKCE code-verifier/cookie
// matching between the "request" and "click the link" steps, which is
// also what makes email links fragile when opened from a different
// browser/device/app than the one that requested them.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/reset-password";

  if (tokenHash && type === "recovery") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/reset-password", origin));
}
