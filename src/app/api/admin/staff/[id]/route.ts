import { requireAdminProfile } from "@/lib/auth/profile";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const VALID_STATUS = ["approved", "rejected"] as const;
const VALID_ROLE = ["admin", "staff"] as const;

export async function PATCH(request: Request, context: RouteContext<"/api/admin/staff/[id]">) {
  const adminProfile = await requireAdminProfile();
  if (!adminProfile) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  if (id === adminProfile.id) {
    return Response.json({ error: "You can't change your own account here." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = (VALID_STATUS as readonly string[]).includes(body.status) ? (body.status as (typeof VALID_STATUS)[number]) : undefined;
  const role = (VALID_ROLE as readonly string[]).includes(body.role) ? (body.role as (typeof VALID_ROLE)[number]) : undefined;

  if (!status && !role) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const update: Record<string, unknown> = {};
  if (role) update.role = role;
  if (status) {
    update.status = status;
    update.approved_at = status === "approved" ? new Date().toISOString() : null;
    update.approved_by = status === "approved" ? adminProfile.id : null;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", id);

  if (error) {
    return Response.json({ error: "We could not update this account. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/admin/staff/[id]">) {
  const adminProfile = await requireAdminProfile();
  if (!adminProfile) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  if (id === adminProfile.id) {
    return Response.json({ error: "You can't delete your own account here." }, { status: 400 });
  }

  // Deleting the auth user cascades to its profiles row; clients.created_by
  // and profiles.approved_by are ON DELETE SET NULL, so anything this person
  // submitted or approved stays — only the account itself goes.
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.auth.admin.deleteUser(id);

  if (error) {
    const notFound = error.status === 404;
    return Response.json(
      { error: notFound ? "This account no longer exists." : "We could not delete this account. Please try again." },
      { status: notFound ? 404 : 500 },
    );
  }

  return Response.json({ ok: true });
}
