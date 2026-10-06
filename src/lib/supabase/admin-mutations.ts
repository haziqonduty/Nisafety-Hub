import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes the document row first, then best-effort removes its file from
 * storage. Deleting the row first means the public site can never show a
 * record whose file is already gone — a storage object surviving a failed
 * cleanup is a harmless, already-known limitation (same class as the
 * orphaned-upload gap on the submission endpoint).
 */
export async function deleteDocumentRecord(supabase: SupabaseClient, documentId: string) {
  const { data: document } = await supabase.from("documents").select("storage_path").eq("id", documentId).single();

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) return { error };

  if (document?.storage_path) {
    await supabase.storage.from("safety-documents").remove([document.storage_path]);
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
