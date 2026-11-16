import { requireApprovedProfile } from "@/lib/auth/profile";
import { isValidLocation } from "@/lib/client-map";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Staff place (or move) a client's pin on the live client map. */
export async function PUT(request: Request, context: RouteContext<"/api/clients/[id]/location">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { latitude?: unknown; longitude?: unknown; label?: unknown } | null;
  const latitude = body?.latitude;
  const longitude = body?.longitude;
  if (!isValidLocation(latitude, longitude)) return Response.json({ error: "INVALID_LOCATION" }, { status: 400 });
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 200) || null : null;

  return save(id, {
    // ~1 m precision is plenty and keeps the stored values tidy.
    latitude: Math.round(latitude * 1e6) / 1e6,
    longitude: Math.round((longitude as number) * 1e6) / 1e6,
    location_label: label,
    location_updated_at: new Date().toISOString(),
    location_updated_by: profile.id,
  });
}

/** Take a client off the map (e.g. it was pinned to the wrong company). */
export async function DELETE(_request: Request, context: RouteContext<"/api/clients/[id]/location">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  return save(id, {
    latitude: null,
    longitude: null,
    location_label: null,
    location_updated_at: new Date().toISOString(),
    location_updated_by: profile.id,
  });
}

async function save(id: string, update: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clients").update(update).eq("id", id).is("deleted_at", null).select("id");
  if (error) return Response.json({ error: "LOCATION_SAVE_ERROR" }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true });
}
