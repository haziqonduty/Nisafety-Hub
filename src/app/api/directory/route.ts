import { requireApprovedProfile } from "@/lib/auth/profile";
import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { getDirectoryPage } from "@/lib/supabase/queries";

/** GET /api/directory?q=&category=&offset= — one page of the staff directory. */
export async function GET(request: Request) {
  if (!(await requireApprovedProfile())) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const search = (params.get("q") ?? "").trim().slice(0, 100);
  const rawCategory = params.get("category");
  const category = rawCategory && (DOCUMENT_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : null;
  const offset = Math.max(0, Math.min(Number.parseInt(params.get("offset") ?? "0", 10) || 0, 100_000));

  return Response.json(await getDirectoryPage({ search, category, offset }));
}
