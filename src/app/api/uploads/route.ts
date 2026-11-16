import { requireApprovedProfile } from "@/lib/auth/profile";
import { createReportUploadTicket, validateUploadRequest } from "@/lib/document-upload";

/**
 * POST /api/uploads  { fileName, fileType, fileSize }
 *   → { path, token }: a one-time link for uploading one report straight to
 *   Supabase Storage (up to 50 MB — it never passes through Vercel, whose
 *   request limit is ~4.5 MB). The save routes then take `storagePath` and
 *   check the uploaded file before using it.
 */
export async function POST(request: Request) {
  if (!(await requireApprovedProfile())) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { fileName?: unknown; fileType?: unknown; fileSize?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const fileType = typeof body?.fileType === "string" ? body.fileType : "";
  const fileSize = typeof body?.fileSize === "number" ? body.fileSize : Number.NaN;

  const validation = validateUploadRequest(fileName, fileType, fileSize);
  if ("error" in validation) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const ticket = await createReportUploadTicket(validation.extension);
  if (!ticket) {
    return Response.json({ error: "UPLOAD_ERROR" }, { status: 500 });
  }
  return Response.json(ticket);
}
