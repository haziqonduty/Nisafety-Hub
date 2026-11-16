// Browser-only: uploads a report straight to Supabase Storage through a
// one-time link from POST /api/uploads, so it never passes through Vercel
// (whose ~4.5 MB request limit used to force PDF compression). Returns the
// storage path to send to the save route as `storagePath`.
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Supabase's free-plan maximum per file; matches MAX_REPORT_SIZE on the server. */
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

export type DirectUploadResult = { storagePath: string } | { error: string };

export async function uploadReportFile(file: File): Promise<DirectUploadResult> {
  let ticket: { path: string; token: string };
  try {
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
    });
    const body = (await response.json().catch(() => ({}))) as { path?: string; token?: string; error?: string };
    if (!response.ok || !body.path || !body.token) return { error: body.error ?? "UPLOAD_ERROR" };
    ticket = { path: body.path, token: body.token };
  } catch {
    return { error: "NETWORK_ERROR" };
  }

  try {
    const { error } = await createSupabaseBrowserClient()
      .storage.from("safety-documents")
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
    if (error) return { error: "UPLOAD_ERROR" };
  } catch {
    return { error: "NETWORK_ERROR" };
  }
  return { storagePath: ticket.path };
}

/**
 * Uploads `file` and appends what the save routes need (storagePath +
 * fileName) to `formData`. Returns an error code instead when the upload
 * fails, so the caller can show it on the right row.
 */
export async function appendUploadedFile(formData: FormData, file: File): Promise<string | null> {
  const result = await uploadReportFile(file);
  if ("error" in result) return result.error;
  formData.append("storagePath", result.storagePath);
  formData.append("fileName", file.name);
  return null;
}
