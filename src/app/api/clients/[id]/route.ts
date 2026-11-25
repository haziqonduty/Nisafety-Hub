import { requireApprovedProfile } from "@/lib/auth/profile";
import { deleteClientRecord } from "@/lib/supabase/admin-mutations";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Staff "Delete client": PERMANENTLY removes the company record with every
 * report and file it has (Kay's choice, 2026-11-25 — no recycle bin for
 * staff deletes). The page asks staff to type the company name first.
 */
export async function DELETE(_request: Request, context: RouteContext<"/api/clients/[id]">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;

  // Session client first: RLS decides whether this staff member can see it.
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!client) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const { error } = await deleteClientRecord(createSupabaseServiceClient(), client.id);
  if (error) return Response.json({ error: "DELETE_ERROR" }, { status: 500 });

  return Response.json({ ok: true });
}
