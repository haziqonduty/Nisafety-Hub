import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes the document row first, then best-effort removes its file from
 * storage. Deleting the row first means the public site can never show a
 * record whose file is already gone — a storage object surviving a failed
 * cleanup is a harmless, already-known limitation (same class as the
 * orphaned-upload gap on the submission endpoint).
 */
export async function deleteDocumentRecord(supabase: SupabaseClient, documentId: string) {
  const { data: document } = await supabase.from("documents").select("storage_path, thumbnail_path").eq("id", documentId).single();

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) return { error };

  // The report AND its preview image — the thumbnail used to be left behind.
  const paths = [document?.storage_path, document?.thumbnail_path].filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await supabase.storage.from("safety-documents").remove(paths);
  }

  return { error: null };
}

export async function deleteClientRecord(supabase: SupabaseClient, clientId: string) {
  const { data: documents } = await supabase.from("documents").select("id").eq("client_id", clientId);

  for (const document of documents ?? []) {
    await deleteDocumentRecord(supabase, document.id);
  }

  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  return { error };
}
