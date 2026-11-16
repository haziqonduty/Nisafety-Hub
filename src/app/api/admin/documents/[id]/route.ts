import { requireAdminProfile } from "@/lib/auth/profile";
import { binDocument } from "@/lib/supabase/admin-mutations";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Moves the report to the recycle bin — restorable for 30 days. */
export async function DELETE(_request: Request, context: RouteContext<"/api/admin/documents/[id]">) {
  const admin = await requireAdminProfile();
  if (!admin) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();
  const { error, notFound } = await binDocument(supabase, id, admin.id);

  if (notFound) {
    return Response.json({ error: "This document no longer exists." }, { status: 404 });
  }
  if (error) {
    return Response.json({ error: "We could not delete this document. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
