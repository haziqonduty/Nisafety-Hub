import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_USERNAME = "admin";

// A fixed internal identity — Supabase Auth needs an email-shaped
// identifier even though the admin signs in with a plain username. Never
// meant to receive mail, never shown to or typed by anyone.
const ADMIN_LOGIN_EMAIL = "admin@nisafetyhub.internal";

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = textValue(body?.username).toLowerCase();
  const password = textValue(body?.password);

  if (username !== ADMIN_USERNAME || !password) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_LOGIN_EMAIL, password });

  if (error) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
