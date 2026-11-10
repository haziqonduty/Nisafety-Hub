import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_LOGIN_EMAIL } from "@/lib/auth/admin-account";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { extensionFromFileName, formatDate, formatFileSize, titleFromFileName, toneForCategory } from "@/lib/format";

const DIRECTORY_LIMIT = 200;

// Short-lived signed URL — the "safety-documents" bucket is private now that
// the whole site requires login (a public bucket would let anyone with a
// leaked URL bypass the login wall entirely). 1 hour comfortably covers a
// single page view/download without over-exposing the link if it's copied
// or cached somewhere.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function signedUrlFor(supabase: SupabaseClient, storagePath: string) {
  const { data } = await supabase.storage.from("safety-documents").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

// Batched sibling of signedUrlFor — the directory page needs a signed URL for
// every file AND thumbnail on the page, and signing one path at a time means
// one Storage API round trip per path (up to ~400 for a full page). This
// does it in a single request and hands back a path->url map instead.
async function signedUrlsFor(supabase: SupabaseClient, storagePaths: string[]) {
  const uniquePaths = [...new Set(storagePaths)];
  if (uniquePaths.length === 0) return new Map<string, string>();

  const { data } = await supabase.storage.from("safety-documents").createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);

  const map = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

export type DirectoryDocument = {
  id: string;
  hasDocument: boolean;
  title: string;
  company: string;
  clientName: string;
  telephone: string;
  email: string;
  additionalClientNames: string[];
  additionalTelephones: string[];
  additionalEmails: string[];
  category: string | null;
  fileType: string | null;
  fileSize: string | null;
  storagePath: string | null;
  publicUrl: string | null;
  thumbnailUrl: string | null;
  date: string;
  createdAt: string;
  tone: ReturnType<typeof toneForCategory> | null;
};

type ClientSummary = {
  client_name: string;
  company_name: string;
  telephone: string;
  email: string;
  additional_client_names: string[] | null;
  additional_telephones: string[] | null;
  additional_emails: string[] | null;
};

type DocumentRow = {
  id: string;
  category: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  thumbnail_path: string | null;
  created_at: string;
  clients: ClientSummary | ClientSummary[] | null;
};

const UNKNOWN_CLIENT: ClientSummary = {
  client_name: "Unknown client",
  company_name: "Unknown organisation",
  telephone: "",
  email: "",
  additional_client_names: [],
  additional_telephones: [],
  additional_emails: [],
};

function clientSummary(clients: DocumentRow["clients"]): ClientSummary {
  if (!clients) return UNKNOWN_CLIENT;
  return Array.isArray(clients) ? (clients[0] ?? UNKNOWN_CLIENT) : clients;
}

function toDirectoryDocument(row: DocumentRow, urls: Map<string, string>): DirectoryDocument {
  const client = clientSummary(row.clients);
  const publicUrl = urls.get(row.storage_path) ?? null;
  const thumbnailUrl = row.thumbnail_path ? (urls.get(row.thumbnail_path) ?? null) : null;

  return {
    id: row.id,
    hasDocument: true,
    title: titleFromFileName(row.file_name),
    company: client.company_name,
    clientName: client.client_name,
    telephone: client.telephone,
    email: client.email,
    additionalClientNames: client.additional_client_names ?? [],
    additionalTelephones: client.additional_telephones ?? [],
    additionalEmails: client.additional_emails ?? [],
    category: row.category,
    fileType: extensionFromFileName(row.file_name),
    fileSize: formatFileSize(row.file_size),
    storagePath: row.storage_path,
    publicUrl,
    thumbnailUrl,
    date: formatDate(row.created_at),
    createdAt: row.created_at,
    tone: toneForCategory(row.category),
  };
}

type ClientOnlyRow = {
  id: string;
  client_name: string;
  company_name: string;
  telephone: string;
  email: string;
  additional_client_names: string[] | null;
  additional_telephones: string[] | null;
  additional_emails: string[] | null;
  created_at: string;
  documents: { id: string }[] | null;
};

function toClientOnlyDirectoryDocument(row: ClientOnlyRow): DirectoryDocument {
  return {
    id: row.id,
    hasDocument: false,
    title: row.company_name,
    company: row.company_name,
    clientName: row.client_name,
    telephone: row.telephone,
    email: row.email,
    additionalClientNames: row.additional_client_names ?? [],
    additionalTelephones: row.additional_telephones ?? [],
    additionalEmails: row.additional_emails ?? [],
    category: null,
    fileType: null,
    fileSize: null,
    storagePath: null,
    publicUrl: null,
    thumbnailUrl: null,
    date: formatDate(row.created_at),
    createdAt: row.created_at,
    tone: null,
  };
}

export async function getDirectoryDocuments(): Promise<DirectoryDocument[]> {
  const supabase = await createSupabaseServerClient();

  const [documentsResult, clientsResult] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, category, file_name, file_size, storage_path, thumbnail_path, created_at, clients(client_name, company_name, telephone, email, additional_client_names, additional_telephones, additional_emails)",
      )
      .order("created_at", { ascending: false })
      .limit(DIRECTORY_LIMIT),
    supabase
      .from("clients")
      .select("id, client_name, company_name, telephone, email, additional_client_names, additional_telephones, additional_emails, created_at, documents(id)")
      .order("created_at", { ascending: false })
      .limit(DIRECTORY_LIMIT),
  ]);

  const documentRows = (documentsResult.data ?? []) as unknown as DocumentRow[];
  const clientOnlyRows = ((clientsResult.data ?? []) as unknown as ClientOnlyRow[]).filter((row) => (row.documents?.length ?? 0) === 0);

  const allPaths = documentRows.flatMap((row) => [row.storage_path, row.thumbnail_path].filter((path): path is string => Boolean(path)));
  const urls = await signedUrlsFor(supabase, allPaths);

  const combined = [
    ...documentRows.map((row) => ({ sortKey: row.created_at, document: toDirectoryDocument(row, urls) })),
    ...clientOnlyRows.map((row) => ({ sortKey: row.created_at, document: toClientOnlyDirectoryDocument(row) })),
  ];

  return combined
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
    .slice(0, DIRECTORY_LIMIT)
    .map((entry) => entry.document);
}

export type RecordDetail = {
  id: string;
  clientId: string;
  hasDocument: boolean;
  clientName: string;
  companyName: string;
  telephone: string;
  email: string;
  submitterName: string;
  additionalClientNames: string[];
  additionalTelephones: string[];
  additionalEmails: string[];
  category: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: string | null;
  storagePath: string | null;
  publicUrl: string | null;
  date: string;
  tone: ReturnType<typeof toneForCategory> | null;
};

type RecordDetailClient = {
  client_name: string;
  company_name: string;
  telephone: string;
  email: string;
  submitter_name: string;
  additional_client_names: string[] | null;
  additional_telephones: string[] | null;
  additional_emails: string[] | null;
};

type RecordDetailRow = {
  id: string;
  client_id: string;
  category: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  clients: RecordDetailClient | RecordDetailClient[] | null;
};

async function getDocumentRecordById(id: string): Promise<RecordDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, client_id, category, file_name, file_size, storage_path, created_at, clients(client_name, company_name, telephone, email, submitter_name, additional_client_names, additional_telephones, additional_emails)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as RecordDetailRow;
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  if (!client) return null;

  return {
    id: row.id,
    clientId: row.client_id,
    hasDocument: true,
    clientName: client.client_name,
    companyName: client.company_name,
    telephone: client.telephone,
    email: client.email,
    submitterName: client.submitter_name,
    additionalClientNames: client.additional_client_names ?? [],
    additionalTelephones: client.additional_telephones ?? [],
    additionalEmails: client.additional_emails ?? [],
    category: row.category,
    fileName: row.file_name,
    fileType: extensionFromFileName(row.file_name),
    fileSize: formatFileSize(row.file_size),
    storagePath: row.storage_path,
    publicUrl: await signedUrlFor(supabase, row.storage_path),
    date: formatDate(row.created_at),
    tone: toneForCategory(row.category),
  };
}

type ClientOnlyRecordRow = {
  id: string;
  client_name: string;
  company_name: string;
  telephone: string;
  email: string;
  submitter_name: string;
  additional_client_names: string[] | null;
  additional_telephones: string[] | null;
  additional_emails: string[] | null;
  created_at: string;
};

async function getClientOnlyRecordById(id: string): Promise<RecordDetail | null> {
  const supabase = await createSupabaseServerClient();

  // A client that originally had no document may have gained one later via
  // the "attach a document" edit — show that document's detail instead of
  // incorrectly claiming no document exists, so an old bookmarked client-id
  // URL stays correct after the fact.
  const { data: attachedDocument } = await supabase
    .from("documents")
    .select("id")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attachedDocument) return getDocumentRecordById(attachedDocument.id);

  const { data, error } = await supabase
    .from("clients")
    .select("id, client_name, company_name, telephone, email, submitter_name, additional_client_names, additional_telephones, additional_emails, created_at")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as ClientOnlyRecordRow;
  return {
    id: row.id,
    clientId: row.id,
    hasDocument: false,
    clientName: row.client_name,
    companyName: row.company_name,
    telephone: row.telephone,
    email: row.email,
    submitterName: row.submitter_name,
    additionalClientNames: row.additional_client_names ?? [],
    additionalTelephones: row.additional_telephones ?? [],
    additionalEmails: row.additional_emails ?? [],
    category: null,
    fileName: null,
    fileType: null,
    fileSize: null,
    storagePath: null,
    publicUrl: null,
    date: formatDate(row.created_at),
    tone: null,
  };
}

export async function getRecordById(id: string): Promise<RecordDetail | null> {
  return (await getDocumentRecordById(id)) ?? (await getClientOnlyRecordById(id));
}

export type OtherClientReport = {
  id: string;
  category: string;
  fileName: string;
  date: string;
};

type OtherDocumentRow = {
  id: string;
  category: string;
  file_name: string;
  created_at: string;
};

// Now that a client can be reused across multiple service reports, a report
// page should let staff discover its siblings rather than treat each one as
// an isolated record. No signed URLs needed here — these are just links to
// other /records/[id] pages, not downloads.
export async function getOtherDocumentsForClient(clientId: string, excludeDocumentId: string | null): Promise<OtherClientReport[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("documents")
    .select("id, category, file_name, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (excludeDocumentId) {
    query = query.neq("id", excludeDocumentId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as OtherDocumentRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    fileName: row.file_name,
    date: formatDate(row.created_at),
  }));
}

type AnalyticsDocumentRow = {
  id: string;
  category: string;
  created_at: string;
  clients: { company_name: string } | { company_name: string }[] | null;
};

export async function getAdminAnalyticsData() {
  const supabase = await createSupabaseServerClient();

  const [documentsResult, clientsResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id, category, created_at, clients(company_name)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("created_at"),
  ]);

  const rows = (documentsResult.data ?? []) as unknown as AnalyticsDocumentRow[];
  const documents = rows.map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      id: row.id,
      category: row.category,
      createdAt: row.created_at,
      companyName: client?.company_name ?? "Unknown organisation",
    };
  });

  const clientCreatedAt = (clientsResult.data ?? []).map((row) => row.created_at as string);

  return { documents, clientCreatedAt };
}

export type AdminClient = {
  id: string;
  clientName: string;
  companyName: string;
  telephone: string;
  email: string;
  submitterName: string;
  additionalClientNames: string[];
  additionalTelephones: string[];
  additionalEmails: string[];
  internalNotes: string | null;
  date: string;
  createdAt: string;
  documents: { id: string; category: string; fileName: string }[];
};

type AdminClientRow = {
  id: string;
  client_name: string;
  company_name: string;
  telephone: string;
  email: string;
  submitter_name: string;
  additional_client_names: string[] | null;
  additional_telephones: string[] | null;
  additional_emails: string[] | null;
  internal_notes: string | null;
  created_at: string;
  documents: { id: string; category: string; file_name: string }[] | null;
};

// internal_notes is admin-only and no longer in anon's column-level grant
// (see the 2026-10-19 migration), so this needs the service-role client —
// safe here since getAdminClients() is only ever called from the already
// session-gated /admin route.
export async function getAdminClients(): Promise<AdminClient[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_name, company_name, telephone, email, submitter_name, additional_client_names, additional_telephones, additional_emails, internal_notes, created_at, documents(id, category, file_name)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as AdminClientRow[]).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    companyName: row.company_name,
    telephone: row.telephone,
    email: row.email,
    submitterName: row.submitter_name,
    additionalClientNames: row.additional_client_names ?? [],
    additionalTelephones: row.additional_telephones ?? [],
    additionalEmails: row.additional_emails ?? [],
    internalNotes: row.internal_notes,
    date: formatDate(row.created_at),
    createdAt: row.created_at,
    documents: (row.documents ?? []).map((document) => ({
      id: document.id,
      category: document.category,
      fileName: document.file_name,
    })),
  }));
}

export type AdminProfile = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "staff";
  status: "pending" | "approved" | "rejected";
  date: string;
  createdAt: string;
};

type AdminProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "staff";
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const STATUS_ORDER: Record<AdminProfile["status"], number> = { pending: 0, approved: 1, rejected: 2 };

// Service-role client: listing every staff account (including other
// people's emails and pending requests) is an admin-only capability, same
// reasoning as getAdminClients()'s internal_notes — only ever called from
// the already session-gated /admin/staff route.
export async function getAllProfiles(): Promise<AdminProfile[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    // The synthetic account behind the username/password admin sign-in
    // isn't a real staff member to approve/manage — exclude it from this
    // list entirely rather than showing a confusing "pending request".
    .neq("email", ADMIN_LOGIN_EMAIL)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as AdminProfileRow[])
    .map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      status: row.status,
      date: formatDate(row.created_at),
      createdAt: row.created_at,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}
