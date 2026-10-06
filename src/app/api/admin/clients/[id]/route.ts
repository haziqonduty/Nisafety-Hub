import { verifyAdminSession } from "@/lib/auth/session";
import { deleteClientRecord } from "@/lib/supabase/admin-mutations";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/clients/[id]">) {
  if (!(await verifyAdminSession())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const clientName = textValue(body.clientName, 160);
  const telephone = textValue(body.telephone, 40);
  const email = textValue(body.email, 254).toLowerCase();

  if (!clientName || !telephone || !email) {
    return Response.json({ error: "Client name, telephone, and email are all required." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("clients")
    .update({ client_name: clientName, telephone, email })
    .eq("id", id);

  if (error) {
    return Response.json({ error: "We could not update this client. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/admin/clients/[id]">) {
  if (!(await verifyAdminSession())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();
  const { error } = await deleteClientRecord(supabase, id);

  if (error) {
    return Response.json({ error: "We could not delete this client. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
