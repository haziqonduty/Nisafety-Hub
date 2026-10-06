import { verifyAdminSession } from "@/lib/auth/session";
import { deleteDocumentRecord } from "@/lib/supabase/admin-mutations";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: RouteContext<"/api/admin/documents/[id]">) {
  if (!(await verifyAdminSession())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();
  const { error } = await deleteDocumentRecord(supabase, id);

  if (error) {
    return Response.json({ error: "We could not delete this document. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
