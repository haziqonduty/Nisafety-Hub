import { requireApprovedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RESULT_LIMIT = 8;

export async function GET(request: Request) {
  const profile = await requireApprovedProfile();
  if (!profile) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const rawQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length < 2) {
    return Response.json({ clients: [] });
  }

  // Strips characters that would otherwise break or escape the .or() filter
  // syntax below (comma separates conditions, parentheses group them).
  const term = rawQuery.replace(/[,()]/g, " ").trim().slice(0, 100);
  const pattern = `%${term}%`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_name, company_name, telephone, email, submitter_name")
    .or(`company_name.ilike.${pattern},client_name.ilike.${pattern},telephone.ilike.${pattern},email.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(RESULT_LIMIT);

  if (error || !data) {
    return Response.json({ clients: [] });
  }

  const clients = data.map((row) => ({
    id: row.id,
    clientName: row.client_name,
    companyName: row.company_name,
    telephone: row.telephone,
    email: row.email,
    submitterName: row.submitter_name,
  }));

  return Response.json({ clients });
}
