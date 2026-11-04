import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/server";

// Vercel's hard per-request body limit is 4.5MB regardless of plan/config
// (confirmed directly: a 6MB upload returns 413 FUNCTION_PAYLOAD_TOO_LARGE
// before this code even runs). 4MB leaves headroom for the other form
// fields and multipart overhead within that ceiling.
export const MAX_FILE_SIZE = 4 * 1024 * 1024;

export const ALLOWED_TYPES = new Map([
  ["pdf", "application/pdf"],
  ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

export type FileValidationError = "INVALID_FILE_TYPE" | "FILE_SIZE";

/** Validates a document File against the same rules everywhere it's accepted. */
export function validateDocumentFile(file: File): { extension: string } | { error: FileValidationError } {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expectedMimeType = extension ? ALLOWED_TYPES.get(extension) : undefined;
  if (!extension || !expectedMimeType || file.type !== expectedMimeType) {
    return { error: "INVALID_FILE_TYPE" };
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return { error: "FILE_SIZE" };
  }
  return { extension };
}

const MAX_THUMBNAIL_SIZE = 500 * 1024;

// Best-effort: a thumbnail is a visual enhancement, not core data, so any
// problem with it (wrong type, too large, upload failure) just means the
// document is saved without one — never a reason to fail the request.
// Always uses the service-role client — the public upload RLS policy
// intentionally only allows pdf/doc/docx extensions, and loosening it just
// for an internal `.thumb.jpg` convention isn't worth it.
export async function uploadThumbnail(documentId: string, thumbnail: FormDataEntryValue | null): Promise<string | null> {
  if (!(thumbnail instanceof File) || thumbnail.type !== "image/jpeg" || thumbnail.size === 0 || thumbnail.size > MAX_THUMBNAIL_SIZE) {
    return null;
  }

  const thumbnailPath = `submissions/${documentId}.thumb.jpg`;
  const { error } = await createSupabaseServiceClient()
    .storage.from("safety-documents")
    .upload(thumbnailPath, thumbnail, { contentType: "image/jpeg", upsert: false });

  return error ? null : thumbnailPath;
}

/** Best-effort removal of storage objects that a new upload just replaced. */
export async function removeStorageObjects(paths: (string | null | undefined)[]) {
  const validPaths = paths.filter((path): path is string => Boolean(path));
  if (validPaths.length === 0) return;
  // Staff has no storage delete grant (by design, same as every other
  // destructive storage action in this app) — cleanup of a now-superseded
  // object always goes through the service-role client.
  await createSupabaseServiceClient().storage.from("safety-documents").remove(validPaths);
}
