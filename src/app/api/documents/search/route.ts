import { requireApprovedProfile } from "@/lib/auth/profile";
import { getDirectoryPage, type DirectoryDocument } from "@/lib/supabase/queries";

const RESULT_LIMIT = 8;

function haystack(document: DirectoryDocument) {
  return [
    document.title,
    document.company,
    document.category ?? "",
    document.clientName,
    document.telephone,
    document.email,
    ...document.additionalClientNames,
    ...document.additionalTelephones,
    ...document.additionalEmails,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * ⌘K search. The database finds the matching clients across the whole
 * directory; from those, the individual reports that match are listed
 * (newest first), so searching "CHRA" shows CHRA reports, not every report
 * of a client that happens to have one.
 */
export async function GET(request: Request) {
  if (!(await requireApprovedProfile())) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const { documents } = await getDirectoryPage({ search: query, limit: RESULT_LIMIT });

  // The database also matches the raw file name (e.g. "report_v2.pdf"), which
  // the display title tidies up — if nothing matches here, fall back to the
  // matched clients' reports rather than showing "no results".
  const exact = query ? documents.filter((document) => haystack(document).includes(query)) : documents;
  const matches = (exact.length > 0 ? exact : documents)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, RESULT_LIMIT);

  return Response.json({
    results: matches.map((document) => ({
      id: document.id,
      title: document.title,
      company: document.company,
      category: document.category,
      fileType: document.fileType,
      thumbnailUrl: document.thumbnailUrl,
    })),
  });
}
