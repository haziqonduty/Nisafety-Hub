import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { clientIpFrom } from "@/lib/request-ip";
import { requireApprovedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/supabase/rate-limit";
import { uploadThumbnail, validateDocumentFile } from "@/lib/document-upload";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const MAX_ADDITIONAL_CONTACTS = 4;

function textValue(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// Client name, telephone, and email can each have more than one entry (e.g.
// two contact persons for one company) — the form appends each one under
// the same field name, so getAll() reads every value back.
function multiTextValue(formData: FormData, key: string, maxLength: number): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().slice(0, maxLength))
    .filter(Boolean);
}

// A document was intended but the submission couldn't be completed partway
// through (upload failed, or the document row failed to save after a
// successful upload). Rather than leave a misleading document-less client
// row or an orphaned storage file behind, undo exactly what this request
// itself just created so the caller gets a clean error and can retry.
//
// The clients row is only deleted when THIS request created it. When the
// request instead reused an existing client (picked via the search
// autocomplete), that row is a real company's record that may already have
// other documents attached — deleting it over an unrelated upload failure
// would be data loss, not a rollback.
async function rollbackFailedSubmission(clientId: string, isNewClient: boolean, storagePath?: string, thumbnailPath?: string) {
  const serviceClient = createSupabaseServiceClient();
  const paths = [storagePath, thumbnailPath].filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await serviceClient.storage.from("safety-documents").remove(paths);
  }
  if (isNewClient) {
    await serviceClient.from("clients").delete().eq("id", clientId);
  }
}

export async function POST(request: Request) {
  // The whole site now requires login — this route used to be the one
  // public write path, but a document submission is now something only a
  // signed-in, admin-approved staff member can do.
  const profile = await requireApprovedProfile();
  if (!profile) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const formData = await request.formData();

  // Honeypot + rate limiting predate the login gate (back when this route
  // was open to anonymous callers) and are now defense-in-depth against a
  // compromised/malicious staff account rather than the primary defense —
  // left in place deliberately, harmless either way.
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

  const clientNames = multiTextValue(formData, "clientName", 160);
  const companyName = textValue(formData.get("companyName"), 160);
  const telephones = multiTextValue(formData, "telephone", 40);
  const emails = multiTextValue(formData, "email", 254).map((value) => value.toLowerCase());
  const submitterName = textValue(formData.get("submitterName"), 160);
  const category = textValue(formData.get("category"), 80);
  const existingClientId = textValue(formData.get("clientId"), 36);
  const file = formData.get("file");
  const thumbnail = formData.get("thumbnail");

  const clientName = clientNames[0] ?? "";
  const telephone = telephones[0] ?? "";
  const email = emails[0] ?? "";
  const additionalClientNames = clientNames.slice(1);
  const additionalTelephones = telephones.slice(1);
  const additionalEmails = emails.slice(1);

  if (!clientName || !companyName || !telephone || !submitterName) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  if (additionalClientNames.length > MAX_ADDITIONAL_CONTACTS || additionalTelephones.length > MAX_ADDITIONAL_CONTACTS || additionalEmails.length > MAX_ADDITIONAL_CONTACTS) {
    return Response.json({ error: "TOO_MANY_CONTACTS" }, { status: 400 });
  }

  if (!emails.every((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
    return Response.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  const hasDocument = file instanceof File;
  let extension: string | undefined;

  if (hasDocument) {
    if (!category || !(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
      return Response.json({ error: "INVALID_CATEGORY" }, { status: 400 });
    }

    const validation = validateDocumentFile(file);
    if ("error" in validation) {
      return Response.json({ error: validation.error }, { status: 400 });
    }
    extension = validation.extension;
  }

  const supabase = await createSupabaseServerClient();

  // Reusing an existing client (picked via the search autocomplete on
  // /submit) only makes sense when adding a NEW document to it — a
  // contact-only "update" with no new document would be a silent no-op
  // (the UI already prevents this; this is the defensive server-side guard
  // for a direct API call).
  if (existingClientId && !hasDocument) {
    return Response.json({ error: "DOCUMENT_REQUIRED_FOR_EXISTING_CLIENT" }, { status: 400 });
  }

  let clientId: string;
  let isNewClient = true;

  if (existingClientId) {
    const { data: existingClient } = await supabase.from("clients").select("id").eq("id", existingClientId).maybeSingle();
    if (existingClient) {
      isNewClient = false;
      clientId = existingClient.id;
      // Reusing a client means the submitted fields are its latest
      // authoritative contact info (staff may have corrected a typo before
      // submitting) — same reasoning as the staff edit route.
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          client_name: clientName,
          company_name: companyName,
          telephone,
          email,
          submitter_name: submitterName,
          additional_client_names: additionalClientNames,
          additional_telephones: additionalTelephones,
          additional_emails: additionalEmails,
        })
        .eq("id", clientId);
      if (updateError) {
        return Response.json({ error: "CLIENT_SAVE_ERROR" }, { status: 500 });
      }
    } else {
      // Stale reference (e.g. deleted mid-session) — never block a
      // legitimate submission over it, just fall through to creating a new
      // client below.
      clientId = "";
    }
  } else {
    clientId = "";
  }

  if (!clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        client_name: clientName,
        company_name: companyName,
        telephone,
        email,
        submitter_name: submitterName,
        additional_client_names: additionalClientNames,
        additional_telephones: additionalTelephones,
        additional_emails: additionalEmails,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (clientError || !client) {
      return Response.json({ error: "CLIENT_SAVE_ERROR" }, { status: 500 });
    }
    clientId = client.id;
  }

  if (!hasDocument) {
    return Response.json({ clientId }, { status: 201 });
  }

  const documentId = crypto.randomUUID();
  const storagePath = `submissions/${documentId}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("safety-documents").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    await rollbackFailedSubmission(clientId, isNewClient);
    return Response.json({ error: "UPLOAD_ERROR" }, { status: 500 });
  }

  const thumbnailPath = await uploadThumbnail(documentId, thumbnail);

  const { error: documentError } = await supabase.from("documents").insert({
    client_id: clientId,
    category,
    file_name: file.name.slice(0, 255),
    storage_path: storagePath,
    file_type: file.type,
    file_size: file.size,
    thumbnail_path: thumbnailPath,
  });

  if (documentError) {
    await rollbackFailedSubmission(clientId, isNewClient, storagePath, thumbnailPath ?? undefined);
    return Response.json({ error: "DOCUMENT_SAVE_ERROR" }, { status: 500 });
  }

  return Response.json({ clientId }, { status: 201 });
}
