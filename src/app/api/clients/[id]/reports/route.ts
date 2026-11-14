import { requireApprovedProfile } from "@/lib/auth/profile";
import { storeReport, validateReport } from "@/lib/document-upload";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * Adds one service report to an existing client — used for every service
 * after the first in a multi-service submission, and by "Add a service" on
 * a client's record page for a later visit. One report per request because
 * Vercel caps a request body at 4.5MB.
 */
export async function POST(request: Request, context: RouteContext<"/api/clients/[id]/reports">) {
  const profile = await requireApprovedProfile();
  if (!profile) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const { id: clientId } = await context.params;
  const formData = await request.formData();
  const category = textValue(formData.get("category"), 80);
  const serviceDate = textValue(formData.get("serviceDate"), 10);

  const validation = validateReport(category, serviceDate, formData.get("file"));
  if ("error" in validation) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  // Session client: RLS (is_approved_staff) gates both the lookup and the
  // insert as this specific staff member.
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const stored = await storeReport(supabase, {
    clientId,
    category,
    serviceDate,
    file: validation.file,
    extension: validation.extension,
    thumbnail: formData.get("thumbnail"),
  });
  if ("error" in stored) {
    return Response.json({ error: stored.error }, { status: 500 });
  }

  return Response.json({ documentId: stored.documentId }, { status: 201 });
}
