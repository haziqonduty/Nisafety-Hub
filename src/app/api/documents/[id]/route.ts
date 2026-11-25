import { requireApprovedProfile } from "@/lib/auth/profile";
import { deleteDocumentRecord } from "@/lib/supabase/admin-mutations";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Staff "Delete report": PERMANENTLY removes one report and its files (Kay's
 * choice, 2026-11-25 — no recycle bin for staff deletes). The client stays.
 * Returns the client id so the page can move to the client's next report.
 */
export async function DELETE(_request: Request, context: RouteContext<"/api/documents/[id]">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;

  // Session client first: RLS decides whether this staff member can see it
  // (approved staff, not already in the admin recycle bin).
  const supabase = await createSupabaseServerClient();
  const { data: document } = await supabase.from("documents").select("id, client_id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // Storage removal needs the service role (staff can't delete bucket objects).
  const { error } = await deleteDocumentRecord(createSupabaseServiceClient(), document.id);
  if (error) return Response.json({ error: "DELETE_ERROR" }, { status: 500 });

  return Response.json({ ok: true, clientId: document.client_id });
}
