import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENT_CATEGORIES, isValidServiceDate, resolveExpiryInput } from "@/lib/format";
import { defaultExpiryFor } from "@/lib/validity";
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

// The first bytes every genuine file of each type starts with. The name
// and the browser-reported type are both chosen by the uploader, so they
// alone can't stop e.g. an executable renamed to report.pdf.
const FILE_SIGNATURES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // "%PDF-"
  doc: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // OLE2 compound file (Word 97–2003)
  docx: [0x50, 0x4b, 0x03, 0x04], // ZIP container (Office Open XML)
  jpg: [0xff, 0xd8, 0xff],
};

// PDF readers accept the "%PDF-" header anywhere in the first 1024 bytes,
// and some scanners/generators put a few bytes before it — don't reject those.
const PDF_HEADER_WINDOW = 1024;

/** Whether the file's content really starts like a `kind` file. */
export async function hasFileSignature(file: File, kind: keyof typeof FILE_SIGNATURES | string) {
  const signature = FILE_SIGNATURES[kind];
  if (!signature) return false;
  const window = kind === "pdf" ? PDF_HEADER_WINDOW : signature.length;
  const head = new Uint8Array(await file.slice(0, window).arrayBuffer());
  const lastStart = kind === "pdf" ? head.length - signature.length : 0;
  for (let start = 0; start <= lastStart; start++) {
    if (signature.every((byte, index) => head[start + index] === byte)) return true;
  }
  return false;
}

/** Validates a document File against the same rules everywhere it's accepted. */
export async function validateDocumentFile(file: File): Promise<{ extension: string } | { error: FileValidationError }> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expectedMimeType = extension ? ALLOWED_TYPES.get(extension) : undefined;
  if (!extension || !expectedMimeType || file.type !== expectedMimeType) {
    return { error: "INVALID_FILE_TYPE" };
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return { error: "FILE_SIZE" };
  }
  if (!(await hasFileSignature(file, extension))) {
    return { error: "INVALID_FILE_TYPE" };
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
  if (!(await hasFileSignature(thumbnail, "jpg"))) {
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

export type ReportValidationError = FileValidationError | "INVALID_CATEGORY" | "INVALID_SERVICE_DATE" | "INVALID_EXPIRY_DATE";

/**
 * Everything a single service report needs before anything is written:
 * a known category, a real service date (not in the future), a valid expiry
 * (auto-filled from the category when not sent), and a valid file. Run
 * before creating a client so a bad report never leaves a half-finished
 * submission behind.
 */
export async function validateReport(
  category: string,
  serviceDate: string,
  expiryInput: string | null,
  file: unknown,
): Promise<{ extension: string; file: File; expiryDate: string | null } | { error: ReportValidationError }> {
  if (!category || !(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) return { error: "INVALID_CATEGORY" };
  if (!isValidServiceDate(serviceDate)) return { error: "INVALID_SERVICE_DATE" };
  const expiry = resolveExpiryInput(expiryInput, serviceDate, defaultExpiryFor(category, serviceDate));
  if ("error" in expiry) return expiry;
  if (!(file instanceof File)) return { error: "INVALID_FILE_TYPE" };
  const validation = await validateDocumentFile(file);
  if ("error" in validation) return validation;
  return { extension: validation.extension, file, expiryDate: expiry.expiryDate };
}

type StoreReportInput = {
  clientId: string;
  category: string;
  serviceDate: string;
  expiryDate: string | null;
  file: File;
  extension: string;
  thumbnail: FormDataEntryValue | null;
};

/**
 * Uploads one already-validated report and creates its `documents` row,
 * using the caller's session client so RLS applies as that staff member.
 * Cleans up its own storage objects if the row can't be saved, so a failure
 * never leaves an orphaned file behind. Shared by the first report of a new
 * submission and every additional service report added to a client.
 */
export async function storeReport(supabase: SupabaseClient, input: StoreReportInput): Promise<{ documentId: string } | { error: "UPLOAD_ERROR" | "DOCUMENT_SAVE_ERROR" }> {
  const objectId = crypto.randomUUID();
  const storagePath = `submissions/${objectId}.${input.extension}`;
  const { error: uploadError } = await supabase.storage.from("safety-documents").upload(storagePath, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (uploadError) return { error: "UPLOAD_ERROR" };

  const thumbnailPath = await uploadThumbnail(objectId, input.thumbnail);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      client_id: input.clientId,
      category: input.category,
      service_date: input.serviceDate,
      expiry_date: input.expiryDate,
      file_name: input.file.name.slice(0, 255),
      storage_path: storagePath,
      file_type: input.file.type,
      file_size: input.file.size,
      thumbnail_path: thumbnailPath,
    })
    .select("id")
    .single();

  if (error || !data) {
    await removeStorageObjects([storagePath, thumbnailPath]);
    return { error: "DOCUMENT_SAVE_ERROR" };
  }
  return { documentId: data.id as string };
}
