import { requireAdminProfile } from "@/lib/auth/profile";
import { binClient } from "@/lib/supabase/admin-mutations";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/clients/[id]">) {
  if (!(await requireAdminProfile())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const clientName = textValue(body.clientName, 160);
  const telephone = textValue(body.telephone, 40);
  const email = textValue(body.email, 254).toLowerCase();
  const internalNotes = textValue(body.internalNotes, 2000);

  if (!clientName || !telephone) {
    return Response.json({ error: "Client name and telephone are required." }, { status: 400 });
  }

  // Email is optional; when given it must look like one.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("clients")
    .update({ client_name: clientName, telephone, email, internal_notes: internalNotes || null })
    .eq("id", id);

  if (error) {
    return Response.json({ error: "We could not update this client. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

/** Moves the client (and its reports) to the recycle bin — restorable for 30 days. */
export async function DELETE(_request: Request, context: RouteContext<"/api/admin/clients/[id]">) {
  const admin = await requireAdminProfile();
  if (!admin) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();
  const { error, notFound } = await binClient(supabase, id, admin.id);

  if (notFound) {
    return Response.json({ error: "This client no longer exists." }, { status: 404 });
  }
  if (error) {
    return Response.json({ error: "We could not delete this client. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
