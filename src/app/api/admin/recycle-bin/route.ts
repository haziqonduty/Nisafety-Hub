import { requireAdminProfile } from "@/lib/auth/profile";
import { purgeBin, purgeClient, purgeDocument, restoreClient, restoreDocument, type MutationResult } from "@/lib/supabase/admin-mutations";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type Body = { action?: unknown; kind?: unknown; id?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/recycle-bin
 *   { action: "restore" | "purge", kind: "client" | "document", id }
 *   { action: "empty" }  — permanently deletes everything in the bin
 */
export async function POST(request: Request) {
  if (!(await requireAdminProfile())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  const supabase = createSupabaseServiceClient();

  if (body.action === "empty") {
    const removed = await purgeBin(supabase, { olderThanDays: 0 });
    return Response.json({ ok: true, removed });
  }

  const kind = body.kind === "client" || body.kind === "document" ? body.kind : null;
  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!kind || !id || (body.action !== "restore" && body.action !== "purge")) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  let result: MutationResult;
  if (body.action === "restore") {
    result = kind === "client" ? await restoreClient(supabase, id) : await restoreDocument(supabase, id);
  } else {
    result = kind === "client" ? await purgeClient(supabase, id) : await purgeDocument(supabase, id);
  }

  if (result.notFound) return Response.json({ error: "This item is no longer in the recycle bin." }, { status: 404 });
  if (result.error) return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  return Response.json({ ok: true });
}
