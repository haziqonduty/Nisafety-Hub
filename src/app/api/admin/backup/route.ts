import { requireAdminProfile } from "@/lib/auth/profile";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

// Long enough for a slow connection to fetch every file in one backup run.
const LINK_TTL_SECONDS = 2 * 60 * 60;

/**
 * GET /api/admin/backup — everything needed for a full backup, built into a
 * ZIP in the admin's browser (src/app/_components/backup-button.tsx):
 * every active client and report row (all columns, so it can be restored
 * from), plus a short-lived signed link per report file. The files are
 * fetched straight from Supabase Storage by the browser, so the backup
 * isn't limited by Vercel's response size or time limits.
 *
 * Recycle-bin items are left out: they're on their way to being deleted.
 */
export async function GET() {
  if (!(await requireAdminProfile())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const [clientsResult, documentsResult, extraFilesResult] = await Promise.all([
    supabase.from("clients").select("*").is("deleted_at", null).order("company_name"),
    supabase.from("documents").select("*").is("deleted_at", null).order("service_date", { ascending: false }),
    supabase.from("document_files").select("*").order("position"),
  ]);
  if (clientsResult.error || documentsResult.error || extraFilesResult.error) {
    return Response.json({ error: "We could not read the records. Please try again." }, { status: 500 });
  }

  const clients = clientsResult.data ?? [];
  const activeClientIds = new Set(clients.map((client) => client.id as string));
  const documents = (documentsResult.data ?? []).filter((document) => activeClientIds.has(document.client_id as string));

  const activeDocumentIds = new Set(documents.map((document) => document.id as string));
  // A report's extra documents (src/lib/report-files.ts).
  const documentFiles = (extraFilesResult.data ?? []).filter((file) => activeDocumentIds.has(file.document_id as string));

  const paths = [...documents.map((document) => document.storage_path as string), ...documentFiles.map((file) => file.storage_path as string)].filter(Boolean);
  const links = new Map<string, string>();
  for (let index = 0; index < paths.length; index += 500) {
    const { data } = await supabase.storage.from("safety-documents").createSignedUrls(paths.slice(index, index + 500), LINK_TTL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) links.set(entry.path, entry.signedUrl);
    }
  }

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      clients,
      documents,
      documentFiles,
      files: documents.map((document) => ({ documentId: document.id, url: links.get(document.storage_path as string) ?? null })),
      extraFiles: documentFiles.map((file) => ({ fileId: file.id, documentId: file.document_id, url: links.get(file.storage_path as string) ?? null })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
