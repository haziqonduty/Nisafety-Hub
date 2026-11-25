import { requireApprovedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/supabase/rate-limit";
import { resolveReportFile, storeReport, validateReport, type ReportFile } from "@/lib/document-upload";
import { cleanRequestedServices } from "@/lib/requested-services";
import { MAX_ADDITIONAL_CONTACTS, mergeIntoCompany } from "@/lib/client-merge";

// Per staff ACCOUNT, not per IP: everyone in the office shares one internet
// address, so an IP limit of 5 blocked the whole office on a busy hour.
// 30 new clients in 15 minutes is far beyond normal work but still stops a
// runaway script or a misused account.
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 30;

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

// The first report couldn't be saved after the client row was written. A
// brand-new client is removed again so the caller gets a clean error and can
// retry without creating a duplicate company. A reused client is never
// deleted — it's a real company's record that may already have other
// reports attached, and deleting it over an unrelated upload failure would
// be data loss, not a rollback. (storeReport() already cleaned up its own
// storage objects.)
async function rollbackNewClient(clientId: string, isNewClient: boolean) {
  if (!isNewClient) return;
  await createSupabaseServiceClient().from("clients").delete().eq("id", clientId);
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

  // Honeypot + rate limit: defense-in-depth against a compromised or misused
  // staff account (the login gate is the primary defense).
  if (textValue(formData.get("website"), 1)) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { limited } = await checkRateLimit(
    "submission_attempts",
    `user:${profile.id}`,
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
  const serviceDate = textValue(formData.get("serviceDate"), 10);
  const expiryInput = formData.has("expiryDate") ? textValue(formData.get("expiryDate"), 10) : null;
  const existingClientId = textValue(formData.get("clientId"), 36);
  const thumbnail = formData.get("thumbnail");
  // A report arrives either already uploaded straight to Storage
  // (storagePath) or, from older clients, as the file itself.
  const hasDocument = formData.has("storagePath") || formData.get("file") instanceof File;
  // Client-only submissions can list the services the client needs (no file, no date).
  const requestedServices = hasDocument ? [] : cleanRequestedServices(formData.getAll("requestedService"));

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

  // This route saves the client plus the FIRST service report of a visit.
  // Any further services from the same visit (or a later one) are added one
  // request each via POST /api/clients/[id]/reports.
  let report: { reportFile: ReportFile; expiryDate: string | null } | null = null;

  if (hasDocument) {
    const validation = await validateReport(category, serviceDate, expiryInput, await resolveReportFile(formData));
    if ("error" in validation) {
      return Response.json({ error: validation.error }, { status: 400 });
    }
    report = validation;
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

  // One record per company: if staff typed in a company that already exists
  // instead of picking it from the search, add to THAT record. A different
  // person / phone / email becomes an extra contact; the main one is kept.
  let joinedExistingCompany = false;
  if (!clientId) {
    const { data: matchId } = await supabase.rpc("find_client_by_company", { company: companyName });
    if (typeof matchId === "string" && matchId) {
      const { data: match } = await supabase
        .from("clients")
        .select("id, client_name, telephone, email, additional_client_names, additional_telephones, additional_emails, requested_services")
        .eq("id", matchId)
        .maybeSingle();
      if (match) {
        const merged = mergeIntoCompany(
          {
            clientName: match.client_name,
            telephone: match.telephone,
            email: match.email,
            additionalClientNames: match.additional_client_names ?? [],
            additionalTelephones: match.additional_telephones ?? [],
            additionalEmails: match.additional_emails ?? [],
            requestedServices: match.requested_services ?? [],
          },
          { clientNames, telephones, emails, requestedServices },
        );
        const { error: mergeError } = await supabase
          .from("clients")
          .update({
            additional_client_names: merged.additionalClientNames,
            additional_telephones: merged.additionalTelephones,
            additional_emails: merged.additionalEmails,
            requested_services: merged.requestedServices,
          })
          .eq("id", match.id);
        if (mergeError) {
          return Response.json({ error: "CLIENT_SAVE_ERROR" }, { status: 500 });
        }
        clientId = match.id;
        isNewClient = false;
        joinedExistingCompany = true;
      }
    }
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
        requested_services: requestedServices,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (clientError || !client) {
      return Response.json({ error: "CLIENT_SAVE_ERROR" }, { status: 500 });
    }
    clientId = client.id;
  }

  if (!report) {
    return Response.json({ clientId, joinedExistingCompany }, { status: 201 });
  }

  const stored = await storeReport(supabase, { clientId, category, serviceDate, expiryDate: report.expiryDate, reportFile: report.reportFile, thumbnail });
  if ("error" in stored) {
    await rollbackNewClient(clientId, isNewClient);
    return Response.json({ error: stored.error }, { status: 500 });
  }

  return Response.json({ clientId, documentId: stored.documentId, joinedExistingCompany }, { status: 201 });
}
