import { requireApprovedProfile } from "@/lib/auth/profile";
import { parseDirectorySort, parseDirectoryStatus } from "@/lib/directory";
import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { getDirectoryPage } from "@/lib/supabase/queries";

/** GET /api/directory?q=&category=&status=&sort=&offset= — one page of the staff directory. */
export async function GET(request: Request) {
  if (!(await requireApprovedProfile())) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const search = (params.get("q") ?? "").trim().slice(0, 100);
  const rawCategory = params.get("category");
  const category = rawCategory && (DOCUMENT_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : null;
  const offset = Math.max(0, Math.min(Number.parseInt(params.get("offset") ?? "0", 10) || 0, 100_000));
  const status = parseDirectoryStatus(params.get("status"));
  const sort = parseDirectorySort(params.get("sort"));

  return Response.json(await getDirectoryPage({ search, category, status, sort, offset }));
}
