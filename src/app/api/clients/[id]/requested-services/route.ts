import { requireApprovedProfile } from "@/lib/auth/profile";
import { cleanRequestedServices } from "@/lib/requested-services";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Staff update the list of services a client needs (recorded without a report). */
export async function PUT(request: Request, context: RouteContext<"/api/clients/[id]/requested-services">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { services?: unknown } | null;
  if (!body || !Array.isArray(body.services)) return Response.json({ error: "INVALID_SERVICES" }, { status: 400 });
  const services = cleanRequestedServices(body.services);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clients").update({ requested_services: services }).eq("id", id).is("deleted_at", null).select("id");
  if (error) return Response.json({ error: "SAVE_ERROR" }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ services });
}
