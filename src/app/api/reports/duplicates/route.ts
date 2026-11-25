import { requireApprovedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_ITEMS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Item = { category: string; serviceDate: string };

/**
 * Before saving, asks: does this client already have a report for the same
 * service on the same date? Only a warning — staff can still upload again.
 * The client is the one picked on the form, else the company the server
 * would join by name (find_client_by_company, same as /api/submissions).
 */
export async function POST(request: Request) {
  const profile = await requireApprovedProfile();
  if (!profile) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  let body: { clientId?: unknown; companyName?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const items: Item[] = (Array.isArray(body.items) ? body.items : [])
    .slice(0, MAX_ITEMS)
    .filter((item): item is Item => typeof item?.category === "string" && typeof item?.serviceDate === "string" && DATE.test(item.serviceDate))
    .map((item) => ({ category: item.category.trim().slice(0, 80), serviceDate: item.serviceDate }));
  if (items.length === 0) return Response.json({ duplicates: [] });

  const supabase = await createSupabaseServerClient();

  let clientId = typeof body.clientId === "string" && UUID.test(body.clientId) ? body.clientId : null;
  if (!clientId && typeof body.companyName === "string" && body.companyName.trim()) {
    const { data } = await supabase.rpc("find_client_by_company", { company: body.companyName.trim().slice(0, 200) });
    clientId = typeof data === "string" ? data : null;
  }
  if (!clientId) return Response.json({ duplicates: [] });

  const { data, error } = await supabase
    .from("documents")
    .select("category, service_date, file_name")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .in("category", [...new Set(items.map((item) => item.category))])
    .in("service_date", [...new Set(items.map((item) => item.serviceDate))]);
  if (error || !data) return Response.json({ duplicates: [] });

  const wanted = new Set(items.map((item) => `${item.category}|${item.serviceDate}`));
  const duplicates = data
    .filter((row) => wanted.has(`${row.category}|${row.service_date}`))
    .map((row) => ({ category: row.category as string, serviceDate: row.service_date as string, fileName: row.file_name as string }));

  return Response.json({ duplicates });
}
