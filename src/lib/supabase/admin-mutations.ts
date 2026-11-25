import type { SupabaseClient } from "@supabase/supabase-js";

/** How long a deleted client/report stays restorable before it's permanently removed. */
export const RECYCLE_BIN_DAYS = 30;

export type MutationResult = { error: { message: string } | null; notFound?: boolean };

// ---------------------------------------------------------------------------
// Recycle bin. "Delete" in the admin area only sets deleted_at; the staff
// RLS policies then hide the row everywhere. Restoring clears it. Rows are
// only erased (with their files) by purge*/purgeExpired below.
// ---------------------------------------------------------------------------

/** Moves a client and all of its (not already binned) reports to the bin, stamped with one shared time. */
export async function binClient(supabase: SupabaseClient, clientId: string, adminId: string): Promise<MutationResult> {
  const deletedAt = new Date().toISOString();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).is("deleted_at", null).maybeSingle();
  if (!client) return { error: { message: "NOT_FOUND" }, notFound: true };

  const { error: documentsError } = await supabase
    .from("documents")
    .update({ deleted_at: deletedAt, deleted_by: adminId })
    .eq("client_id", clientId)
    .is("deleted_at", null);
  if (documentsError) return { error: documentsError };

  const { error } = await supabase.from("clients").update({ deleted_at: deletedAt, deleted_by: adminId }).eq("id", clientId);
  return { error };
}

/** Moves one report to the bin. */
export async function binDocument(supabase: SupabaseClient, documentId: string, adminId: string): Promise<MutationResult> {
  const { data, error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: adminId })
    .eq("id", documentId)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error };
  if (!data || data.length === 0) return { error: { message: "NOT_FOUND" }, notFound: true };
  return { error: null };
}

/**
 * Restores a binned client and the reports that were binned WITH it (same
 * timestamp). Reports deleted on their own earlier stay in the bin.
 */
export async function restoreClient(supabase: SupabaseClient, clientId: string): Promise<MutationResult> {
  const { data: client } = await supabase.from("clients").select("deleted_at").eq("id", clientId).not("deleted_at", "is", null).maybeSingle();
  if (!client) return { error: { message: "NOT_FOUND" }, notFound: true };

  const { error: documentsError } = await supabase
    .from("documents")
    .update({ deleted_at: null, deleted_by: null })
    .eq("client_id", clientId)
    .eq("deleted_at", client.deleted_at);
  if (documentsError) return { error: documentsError };

  const { error } = await supabase.from("clients").update({ deleted_at: null, deleted_by: null }).eq("id", clientId);
  return { error };
}

/** Restores one report whose client is still active. */
export async function restoreDocument(supabase: SupabaseClient, documentId: string): Promise<MutationResult> {
  const { data, error } = await supabase
    .from("documents")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", documentId)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return { error };
  if (!data || data.length === 0) return { error: { message: "NOT_FOUND" }, notFound: true };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Permanent removal (from the bin only).
// ---------------------------------------------------------------------------

/**
 * Deletes the document row first, then best-effort removes its file and
 * preview image from storage. Deleting the row first means the site can
 * never show a record whose file is already gone — a storage object
 * surviving a failed cleanup is harmless.
 */
export async function deleteDocumentRecord(supabase: SupabaseClient, documentId: string): Promise<MutationResult> {
  const [{ data: document }, { data: extraFiles }] = await Promise.all([
    supabase.from("documents").select("storage_path, thumbnail_path").eq("id", documentId).single(),
    supabase.from("document_files").select("storage_path").eq("document_id", documentId),
  ]);

  // Its extra-file rows go with it (on delete cascade).
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) return { error };

  // The report, its preview image and its extra documents.
  const paths = [document?.storage_path, document?.thumbnail_path, ...(extraFiles ?? []).map((file) => file.storage_path)].filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await supabase.storage.from("safety-documents").remove(paths);
  }

  return { error: null };
}

export async function deleteClientRecord(supabase: SupabaseClient, clientId: string): Promise<MutationResult> {
  const { data: documents } = await supabase.from("documents").select("id").eq("client_id", clientId);

  for (const document of documents ?? []) {
    await deleteDocumentRecord(supabase, document.id);
  }

  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  return { error };
}

/** Permanently deletes a binned client (with all its reports and files). Refuses anything not in the bin. */
export async function purgeClient(supabase: SupabaseClient, clientId: string): Promise<MutationResult> {
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).not("deleted_at", "is", null).maybeSingle();
  if (!data) return { error: { message: "NOT_FOUND" }, notFound: true };
  return deleteClientRecord(supabase, clientId);
}

/** Permanently deletes a binned report and its files. Refuses anything not in the bin. */
export async function purgeDocument(supabase: SupabaseClient, documentId: string): Promise<MutationResult> {
  const { data } = await supabase.from("documents").select("id").eq("id", documentId).not("deleted_at", "is", null).maybeSingle();
  if (!data) return { error: { message: "NOT_FOUND" }, notFound: true };
  return deleteDocumentRecord(supabase, documentId);
}

/** Permanently removes everything that has been in the bin longer than RECYCLE_BIN_DAYS (or everything, when emptying). */
export async function purgeBin(supabase: SupabaseClient, { olderThanDays = RECYCLE_BIN_DAYS }: { olderThanDays?: number } = {}) {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const [{ data: clients }, { data: documents }] = await Promise.all([
    supabase.from("clients").select("id").not("deleted_at", "is", null).lte("deleted_at", cutoff),
    supabase.from("documents").select("id").not("deleted_at", "is", null).lte("deleted_at", cutoff),
  ]);
  let removed = 0;
  for (const client of clients ?? []) {
    if (!(await deleteClientRecord(supabase, client.id)).error) removed += 1;
  }
  for (const document of documents ?? []) {
    // May already be gone with its client above.
    const { data: stillThere } = await supabase.from("documents").select("id").eq("id", document.id).maybeSingle();
    if (stillThere && !(await deleteDocumentRecord(supabase, document.id)).error) removed += 1;
  }
  return removed;
}
