import { isValidServiceDate } from "@/lib/format";
import { defaultExpiryFor } from "@/lib/validity";
import { requireApprovedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DocumentRow = {
  id: string;
  category: string;
  service_date: string;
  expiry_date: string | null;
};

/**
 * Staff confirm (or correct) a report's date of monitoring. The expiry is
 * counted from it, so:
 * - an expiry that was auto-calculated from the old date moves with it;
 * - a custom expiry is kept, unless the new date would land on/after it,
 *   in which case it falls back to the category default;
 * - "no fixed expiry" stays that way.
 */
export async function POST(request: Request, context: RouteContext<"/api/records/[id]/service-date">) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { serviceDate?: unknown } | null;
  const serviceDate = typeof body?.serviceDate === "string" ? body.serviceDate.trim() : "";
  if (!isValidServiceDate(serviceDate)) return Response.json({ error: "INVALID_SERVICE_DATE" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: document } = await supabase.from("documents").select("id, category, service_date, expiry_date").eq("id", id).maybeSingle<DocumentRow>();
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const previousAuto = defaultExpiryFor(document.category, document.service_date);
  const newAuto = defaultExpiryFor(document.category, serviceDate);
  let expiryDate = document.expiry_date;
  if (expiryDate !== null && (expiryDate === previousAuto || expiryDate <= serviceDate)) {
    expiryDate = newAuto;
  }

  const { error } = await supabase
    .from("documents")
    .update({ service_date: serviceDate, service_date_confirmed: true, expiry_date: expiryDate })
    .eq("id", document.id);
  if (error) return Response.json({ error: "DOCUMENT_SAVE_ERROR" }, { status: 500 });

  return Response.json({ ok: true, serviceDate, expiryDate });
}
