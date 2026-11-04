import { DOCUMENT_CATEGORIES } from "@/lib/format";
import { requireApprovedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { removeStorageObjects, uploadThumbnail, validateDocumentFile } from "@/lib/document-upload";

const MAX_ADDITIONAL_CONTACTS = 4;

function textValue(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// Client name, telephone, and email can each have more than one entry (e.g.
// two contact persons for one company) — same convention as /api/submissions.
function multiTextValue(formData: FormData, key: string, maxLength: number): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().slice(0, maxLength))
    .filter(Boolean);
}

type ExistingDocument = {
  id: string;
  client_id: string;
  category: string;
  storage_path: string;
  thumbnail_path: string | null;
};

export async function PATCH(request: Request, context: RouteContext<"/api/records/[id]">) {
  const profile = await requireApprovedProfile();
  if (!profile) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  // Same ambiguous-id resolution as getRecordById(): the id in the URL is
  // either an existing document's id, or a document-less client's own id.
  const { data: existingDocument } = await supabase
    .from("documents")
    .select("id, client_id, category, storage_path, thumbnail_path")
    .eq("id", id)
    .maybeSingle<ExistingDocument>();

  let clientId: string;
  if (existingDocument) {
    clientId = existingDocument.client_id;
  } else {
    const { data: clientRow } = await supabase.from("clients").select("id").eq("id", id).maybeSingle();
    if (!clientRow) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    clientId = clientRow.id;
  }

  const formData = await request.formData();
  const clientNames = multiTextValue(formData, "clientName", 160);
  const companyName = textValue(formData.get("companyName"), 160);
  const telephones = multiTextValue(formData, "telephone", 40);
  const emails = multiTextValue(formData, "email", 254).map((value) => value.toLowerCase());
  const submitterName = textValue(formData.get("submitterName"), 160);
  const category = textValue(formData.get("category"), 80);
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

  const { error: clientUpdateError } = await supabase
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

  if (clientUpdateError) {
    return Response.json({ error: "CLIENT_SAVE_ERROR" }, { status: 500 });
  }

  const hasNewFile = file instanceof File;

  if (!hasNewFile) {
    // No replacement/attachment file — the only other possible document
    // change is the category on an already-existing document.
    if (existingDocument && category && category !== existingDocument.category) {
      if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
        return Response.json({ error: "INVALID_CATEGORY" }, { status: 400 });
      }
      const { error } = await supabase.from("documents").update({ category }).eq("id", existingDocument.id);
      if (error) return Response.json({ error: "DOCUMENT_SAVE_ERROR" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  // A file was provided — either replacing an existing document or
  // attaching a first one to a previously client-only record. Both need a
  // valid category.
  if (!category || !(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
    return Response.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const validation = validateDocumentFile(file);
  if ("error" in validation) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const newDocumentId = crypto.randomUUID();
  const storagePath = `submissions/${newDocumentId}.${validation.extension}`;
  const { error: uploadError } = await supabase.storage.from("safety-documents").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return Response.json({ error: "UPLOAD_ERROR" }, { status: 500 });
  }

  const thumbnailPath = await uploadThumbnail(newDocumentId, thumbnail);

  if (existingDocument) {
    const { error } = await supabase
      .from("documents")
      .update({
        category,
        file_name: file.name.slice(0, 255),
        storage_path: storagePath,
        file_type: file.type,
        file_size: file.size,
        thumbnail_path: thumbnailPath,
      })
      .eq("id", existingDocument.id);

    if (error) {
      await removeStorageObjects([storagePath, thumbnailPath]);
      return Response.json({ error: "DOCUMENT_SAVE_ERROR" }, { status: 500 });
    }

    await removeStorageObjects([existingDocument.storage_path, existingDocument.thumbnail_path]);
    return Response.json({ ok: true });
  }

  const { error: insertError } = await supabase.from("documents").insert({
    client_id: clientId,
    category,
    file_name: file.name.slice(0, 255),
    storage_path: storagePath,
    file_type: file.type,
    file_size: file.size,
    thumbnail_path: thumbnailPath,
  });

  if (insertError) {
    await removeStorageObjects([storagePath, thumbnailPath]);
    return Response.json({ error: "DOCUMENT_SAVE_ERROR" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
