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

// Reports uploaded straight from the browser to Supabase Storage (see
// createReportUploadTicket) skip Vercel entirely, so they're only bound by
// the bucket's limit — Supabase's free-plan maximum per file.
export const MAX_REPORT_SIZE = 50 * 1024 * 1024;

const BUCKET = "safety-documents";

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

/** How many leading bytes hasFileSignature/bytesHaveSignature need to look at. */
function signatureWindow(kind: string) {
  return kind === "pdf" ? PDF_HEADER_WINDOW : (FILE_SIGNATURES[kind]?.length ?? 0);
}

/** Whether these leading bytes of a file look like a `kind` file. */
export function bytesHaveSignature(head: Uint8Array, kind: keyof typeof FILE_SIGNATURES | string) {
  const signature = FILE_SIGNATURES[kind];
  if (!signature) return false;
  const lastStart = kind === "pdf" ? Math.min(head.length, PDF_HEADER_WINDOW) - signature.length : 0;
  for (let start = 0; start <= lastStart; start++) {
    if (signature.every((byte, index) => head[start + index] === byte)) return true;
  }
  return false;
}

/** Whether the file's content really starts like a `kind` file. */
export async function hasFileSignature(file: File, kind: keyof typeof FILE_SIGNATURES | string) {
  if (!FILE_SIGNATURES[kind]) return false;
  return bytesHaveSignature(new Uint8Array(await file.slice(0, signatureWindow(kind)).arrayBuffer()), kind);
}

// ---------------------------------------------------------------------------
// Direct uploads: the browser asks for a one-time upload link, sends the
// report straight to Supabase Storage, then hands the storage path to the
// save route, which checks the uploaded object before using it.
// ---------------------------------------------------------------------------

const UPLOADED_REPORT_PATH = /^submissions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$/;

/** Checks the name/type/size the browser says it's about to upload. */
export function validateUploadRequest(fileName: string, fileType: string, fileSize: number): { extension: string } | { error: FileValidationError } {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const expectedMimeType = extension ? ALLOWED_TYPES.get(extension) : undefined;
  if (!extension || !expectedMimeType || fileType !== expectedMimeType) return { error: "INVALID_FILE_TYPE" };
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_REPORT_SIZE) return { error: "FILE_SIZE" };
  return { extension };
}

/** A one-time link for uploading one report straight to Storage, at a fresh, unguessable path. */
export async function createReportUploadTicket(extension: string): Promise<{ path: string; token: string } | null> {
  const path = `submissions/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await createSupabaseServiceClient().storage.from(BUCKET).createSignedUploadUrl(path);
  return error || !data ? null : { path: data.path, token: data.token };
}

export type UploadedReport = { storagePath: string; extension: string; fileName: string; fileType: string; fileSize: number };

/**
 * Verifies a report the browser uploaded directly: a path we hand out, not
 * already used by another report, really in Storage, within the size limit,
 * with the right type AND the right file signature. Anything that fails is
 * deleted so a bad upload can't linger.
 */
export async function claimUploadedReport(storagePath: string, fileName: string): Promise<UploadedReport | { error: FileValidationError | "UPLOAD_ERROR" }> {
  const match = UPLOADED_REPORT_PATH.exec(storagePath);
  if (!match) return { error: "INVALID_FILE_TYPE" };
  const extension = match[1];
  const expectedMimeType = ALLOWED_TYPES.get(extension)!;
  const service = createSupabaseServiceClient();

  const { data: alreadyUsed } = await service.from("documents").select("id").eq("storage_path", storagePath).limit(1);
  if (alreadyUsed && alreadyUsed.length > 0) return { error: "INVALID_FILE_TYPE" };

  const { data: info, error: infoError } = await service.storage.from(BUCKET).info(storagePath);
  if (infoError || !info) return { error: "UPLOAD_ERROR" };

  const reject = async (error: FileValidationError) => {
    await service.storage.from(BUCKET).remove([storagePath]);
    return { error };
  };
  const size = Number(info.size ?? 0);
  if (size <= 0 || size > MAX_REPORT_SIZE) return reject("FILE_SIZE");
  if (info.contentType !== expectedMimeType) return reject("INVALID_FILE_TYPE");

  const { data: signed } = await service.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (!signed?.signedUrl) return { error: "UPLOAD_ERROR" };
  const head = await fetch(signed.signedUrl, { headers: { Range: `bytes=0-${signatureWindow(extension) - 1}` } })
    .then(async (response) => (response.ok ? new Uint8Array(await response.arrayBuffer()) : null))
    .catch(() => null);
  if (!head) return { error: "UPLOAD_ERROR" };
  if (!bytesHaveSignature(head, extension)) return reject("INVALID_FILE_TYPE");

  const cleanName = fileName.trim().slice(0, 255) || `report.${extension}`;
  return { storagePath, extension, fileName: cleanName, fileType: expectedMimeType, fileSize: size };
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
export type ReportFile = { kind: "file"; file: File; extension: string } | ({ kind: "uploaded" } & UploadedReport);

/** The report's file from a form: a directly uploaded one (storagePath + fileName) or, for older clients, the file itself. */
export async function resolveReportFile(formData: FormData): Promise<ReportFile | { error: FileValidationError | "UPLOAD_ERROR" } | null> {
  const storagePath = formData.get("storagePath");
  if (typeof storagePath === "string" && storagePath) {
    const fileName = formData.get("fileName");
    const claimed = await claimUploadedReport(storagePath, typeof fileName === "string" ? fileName : "");
    return "error" in claimed ? claimed : { kind: "uploaded", ...claimed };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return null;
  const validation = await validateDocumentFile(file);
  return "error" in validation ? validation : { kind: "file", file, extension: validation.extension };
}

export async function validateReport(
  category: string,
  serviceDate: string,
  expiryInput: string | null,
  reportFile: ReportFile | { error: FileValidationError | "UPLOAD_ERROR" } | null,
): Promise<{ reportFile: ReportFile; expiryDate: string | null } | { error: ReportValidationError | "UPLOAD_ERROR" }> {
  if (!category || !(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) return { error: "INVALID_CATEGORY" };
  if (!isValidServiceDate(serviceDate)) return { error: "INVALID_SERVICE_DATE" };
  const expiry = resolveExpiryInput(expiryInput, serviceDate, defaultExpiryFor(category, serviceDate));
  if ("error" in expiry) return expiry;
  if (!reportFile) return { error: "INVALID_FILE_TYPE" };
  if ("error" in reportFile) return reportFile;
  return { reportFile, expiryDate: expiry.expiryDate };
}

/** Puts a report file in Storage if it isn't there yet; returns its path, name, type and size. */
export async function placeReportFile(supabase: SupabaseClient, reportFile: ReportFile): Promise<{ storagePath: string; objectId: string; fileName: string; fileType: string; fileSize: number } | null> {
  if (reportFile.kind === "uploaded") {
    const objectId = reportFile.storagePath.slice("submissions/".length).split(".")[0];
    return { storagePath: reportFile.storagePath, objectId, fileName: reportFile.fileName, fileType: reportFile.fileType, fileSize: reportFile.fileSize };
  }
  const objectId = crypto.randomUUID();
  const storagePath = `submissions/${objectId}.${reportFile.extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, reportFile.file, { contentType: reportFile.file.type, upsert: false });
  if (error) return null;
  return { storagePath, objectId, fileName: reportFile.file.name.slice(0, 255), fileType: reportFile.file.type, fileSize: reportFile.file.size };
}

type StoreReportInput = {
  clientId: string;
  category: string;
  serviceDate: string;
  expiryDate: string | null;
  reportFile: ReportFile;
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
  const placed = await placeReportFile(supabase, input.reportFile);
  if (!placed) return { error: "UPLOAD_ERROR" };
  const { storagePath, objectId } = placed;

  const thumbnailPath = await uploadThumbnail(objectId, input.thumbnail);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      client_id: input.clientId,
      category: input.category,
      service_date: input.serviceDate,
      expiry_date: input.expiryDate,
      file_name: placed.fileName,
      storage_path: storagePath,
      file_type: placed.fileType,
      file_size: placed.fileSize,
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

/**
 * Deletes files in the bucket that no report (active or in the recycle bin)
 * points to and that are older than a day — e.g. a report uploaded straight
 * to Storage whose form was then abandoned. The day's grace covers uploads
 * that are still being saved.
 */
export async function purgeAbandonedUploads(): Promise<number> {
  const service = createSupabaseServiceClient();
  const { data: documents } = await service.from("documents").select("storage_path, thumbnail_path");
  const inUse = new Set((documents ?? []).flatMap((row) => [row.storage_path, row.thumbnail_path]).filter(Boolean));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const abandoned: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: objects, error } = await service.storage.from(BUCKET).list("submissions", { limit: 1000, offset });
    if (error || !objects) return 0;
    for (const object of objects) {
      const path = `submissions/${object.name}`;
      const created = Date.parse(object.created_at ?? "");
      if (!inUse.has(path) && Number.isFinite(created) && created < cutoff) abandoned.push(path);
    }
    if (objects.length < 1000) break;
  }
  for (let index = 0; index < abandoned.length; index += 100) {
    await service.storage.from(BUCKET).remove(abandoned.slice(index, index + 100));
  }
  return abandoned.length;
}
