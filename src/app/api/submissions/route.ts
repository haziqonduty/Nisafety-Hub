import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { clientIpFrom } from "@/lib/request-ip";
import { createSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/supabase/rate-limit";

// Vercel's hard per-request body limit is 4.5MB regardless of plan/config
// (confirmed directly: a 6MB upload returns 413 FUNCTION_PAYLOAD_TOO_LARGE
// before this code even runs). 4MB leaves headroom for the other form
// fields and multipart overhead within that ceiling.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["pdf", "application/pdf"],
  ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function textValue(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const formData = await request.formData();

  // Honeypot: real users never see or fill this field (see submit/page.tsx).
  // A filled value means a bot blindly submitted every field it found.
  if (textValue(formData.get("website"), 1)) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const ipAddress = clientIpFrom(request);
  const { limited } = await checkRateLimit(
    "submission_attempts",
    ipAddress,
    RATE_LIMIT_WINDOW_MINUTES,
    RATE_LIMIT_MAX_ATTEMPTS,
  );

  if (limited) {
    return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const clientName = textValue(formData.get("clientName"), 160);
  const companyName = textValue(formData.get("companyName"), 160);
  const telephone = textValue(formData.get("telephone"), 40);
  const email = textValue(formData.get("email"), 254).toLowerCase();
  const submitterName = textValue(formData.get("submitterName"), 160);
  const category = textValue(formData.get("category"), 80);
  const file = formData.get("file");

  if (!clientName || !companyName || !telephone || !submitterName) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  const hasDocument = file instanceof File;
  let extension: string | undefined;

  if (hasDocument) {
    if (!category || !(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
      return Response.json({ error: "INVALID_CATEGORY" }, { status: 400 });
    }

    extension = file.name.split(".").pop()?.toLowerCase();
    const expectedMimeType = extension ? ALLOWED_TYPES.get(extension) : undefined;
    if (!extension || !expectedMimeType || file.type !== expectedMimeType) {
      return Response.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "FILE_SIZE" }, { status: 400 });
    }
  }

  const supabase = createSupabaseClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      client_name: clientName,
      company_name: companyName,
      telephone,
      email,
      submitter_name: submitterName,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    return Response.json({ error: "CLIENT_SAVE_ERROR" }, { status: 500 });
  }

  if (!hasDocument) {
    return Response.json({ clientId: client.id }, { status: 201 });
  }

  const storagePath = `submissions/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("safety-documents").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return Response.json({ error: "UPLOAD_ERROR" }, { status: 500 });
  }

  const { error: documentError } = await supabase.from("documents").insert({
    client_id: client.id,
    category,
    file_name: file.name.slice(0, 255),
    storage_path: storagePath,
    file_type: file.type,
    file_size: file.size,
  });

  if (documentError) {
    return Response.json({ error: "DOCUMENT_SAVE_ERROR" }, { status: 500 });
  }

  return Response.json({ clientId: client.id }, { status: 201 });
}
