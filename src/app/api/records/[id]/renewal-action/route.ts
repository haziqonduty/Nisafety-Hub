import { requireApprovedProfile } from "@/lib/auth/profile";
import { isRenewalCloseReason } from "@/lib/validity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * "Action taken": close a report's renewal (e.g. the client used another
 * consultant) so it stops counting as expired/expiring. DELETE undoes it.
 * `id` is the report (document) id.
 */
export async function POST(request: Request, context: RouteContext<"/api/records/[id]/renewal-action">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  if (!body || !isRenewalCloseReason(body.reason)) return Response.json({ error: "INVALID_REASON" }, { status: 400 });

  return save(id, { renewal_closed_at: new Date().toISOString(), renewal_closed_reason: body.reason, renewal_closed_by: profile.id });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/records/[id]/renewal-action">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  return save(id, { renewal_closed_at: null, renewal_closed_reason: null, renewal_closed_by: null });
}

async function save(id: string, changes: Record<string, string | null>) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("documents").update(changes).eq("id", id).is("deleted_at", null).select("id");
  if (error) return Response.json({ error: "SAVE_ERROR" }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
