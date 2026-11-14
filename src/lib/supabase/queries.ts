import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_LOGIN_EMAIL } from "@/lib/auth/admin-account";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { extensionFromFileName, formatDate, formatFileSize, titleFromFileName, todayInMalaysia, toneForCategory } from "@/lib/format";
import { expiryStatus, type ExpiryStatus } from "@/lib/validity";

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
  /** The owning client's id — lets the directory group several service reports under one company. */
  clientId: string;
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
  /** YYYY-MM-DD day the service was carried out; null for a client with no report yet. */
  serviceDate: string | null;
  /** YYYY-MM-DD the service needs redoing; null when there's no fixed expiry (or no report). */
  expiryDate: string | null;
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
  client_id: string;
  category: string;
  service_date: string;
  expiry_date: string | null;
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
    clientId: row.client_id,
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
    serviceDate: row.service_date,
    expiryDate: row.expiry_date,
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
    clientId: row.id,
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
    serviceDate: null,
    expiryDate: null,
    tone: null,
  };
}

export async function getDirectoryDocuments(): Promise<DirectoryDocument[]> {
  const supabase = await createSupabaseServerClient();

  const [documentsResult, clientsResult] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, client_id, category, service_date, expiry_date, file_name, file_size, storage_path, thumbnail_path, created_at, clients(client_name, company_name, telephone, email, additional_client_names, additional_telephones, additional_emails)",
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
  /** YYYY-MM-DD day the service was carried out; null for a client with no report yet. */
  serviceDate: string | null;
  expiryDate: string | null;
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
  service_date: string;
  expiry_date: string | null;
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
    .select("id, client_id, category, service_date, expiry_date, file_name, file_size, storage_path, created_at, clients(client_name, company_name, telephone, email, submitter_name, additional_client_names, additional_telephones, additional_emails)")
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
    serviceDate: row.service_date,
    expiryDate: row.expiry_date,
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
    serviceDate: null,
    expiryDate: null,
    tone: null,
  };
}

export async function getRecordById(id: string): Promise<RecordDetail | null> {
  return (await getDocumentRecordById(id)) ?? (await getClientOnlyRecordById(id));
}

export type ServiceHistoryEntry = {
  id: string;
  category: string;
  fileName: string;
  fileType: string;
  /** YYYY-MM-DD */
  serviceDate: string;
  expiryDate: string | null;
};

type ServiceHistoryRow = {
  id: string;
  category: string;
  file_name: string;
  service_date: string;
  expiry_date: string | null;
  created_at: string;
};

// Every service report for one client, newest visit first (and newest
// upload first within a visit) — the record page groups these by
// service_date into a visit timeline. No signed URLs: these are links to
// other /records/[id] pages, not downloads.
export async function getClientServiceHistory(clientId: string): Promise<ServiceHistoryEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, category, file_name, service_date, expiry_date, created_at")
    .eq("client_id", clientId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as ServiceHistoryRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    fileName: row.file_name,
    fileType: extensionFromFileName(row.file_name),
    serviceDate: row.service_date,
    expiryDate: row.expiry_date,
  }));
}

export type RenewalItem = {
  id: string;
  clientId: string;
  company: string;
  clientName: string;
  category: string;
  serviceDate: string;
  expiryDate: string;
  status: Exclude<ExpiryStatus, "none" | "renewed">;
  daysLeft: number;
};

export type RenewalSummary = {
  items: RenewalItem[];
  expired: number;
  expiring: number;
  upcoming: number;
  valid: number;
};

type RenewalRow = {
  id: string;
  client_id: string;
  category: string;
  service_date: string;
  expiry_date: string | null;
  created_at: string;
  clients: { company_name: string; client_name: string } | { company_name: string; client_name: string }[] | null;
};

/**
 * Every service that's currently being tracked for renewal: for each client
 * and service category, only the LATEST report counts (by service date, then
 * upload time) — uploading a renewal automatically clears the old report's
 * alert. Reports with no fixed expiry are left out. Sorted soonest first.
 */
export async function getRenewals(): Promise<RenewalSummary> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("documents")
    .select("id, client_id, category, service_date, expiry_date, created_at, clients(company_name, client_name)")
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  const today = todayInMalaysia();
  const seen = new Set<string>();
  const items: RenewalItem[] = [];
  for (const row of (data ?? []) as unknown as RenewalRow[]) {
    const key = `${row.client_id}|${row.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!row.expiry_date) continue;
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const { status, daysLeft } = expiryStatus(row.expiry_date, today);
    items.push({
      id: row.id,
      clientId: row.client_id,
      company: client?.company_name ?? "Unknown organisation",
      clientName: client?.client_name ?? "",
      category: row.category,
      serviceDate: row.service_date,
      expiryDate: row.expiry_date,
      status: status as RenewalItem["status"],
      daysLeft: daysLeft ?? 0,
    });
  }
  items.sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0));

  return {
    items,
    expired: items.filter((item) => item.status === "expired").length,
    expiring: items.filter((item) => item.status === "expiring").length,
    upcoming: items.filter((item) => item.status === "upcoming").length,
    valid: items.filter((item) => item.status === "valid").length,
  };
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

export type WorkspaceRecord = {
  /** `/records/[id]` target — the latest document's id, or the client's own id when no report is attached yet. */
  id: string;
  company: string;
  clientName: string;
  category: string | null;
  fileType: string | null;
  thumbnailUrl: string | null;
  documentCount: number;
  date: string;
  createdAt: string;
};

export type WorkspaceData = {
  totalDocuments: number;
  totalClients: number;
  /** Documents published per day over the last 14 days, oldest first. */
  dailyDocuments: number[];
  thisWeekDocuments: number;
  lastWeekDocuments: number;
  /** Records the signed-in user created, newest first (max 5). */
  myRecent: WorkspaceRecord[];
  /** The signed-in user's client records that still have no report attached (max 3 shown). */
  myIncomplete: WorkspaceRecord[];
  myIncompleteCount: number;
  /** Admin only — sign-ups waiting for approval. */
  pendingApprovals: { count: number; names: string[] } | null;
};

type WorkspaceClientRow = {
  id: string;
  client_name: string;
  company_name: string;
  created_at: string;
  documents: { id: string; file_name: string; category: string; thumbnail_path: string | null; created_at: string }[] | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PULSE_DAYS = 14;

/**
 * Everything the staff workspace (/) shows above the directory. One round of
 * parallel queries, all through the session client so RLS applies as the
 * signed-in user — except the pending-approvals peek, which is admin-only
 * data and goes through the service client only when the caller is an admin
 * (same reasoning as getAllProfiles()).
 */
export async function getWorkspaceData(profile: { id: string; role: "admin" | "staff" }): Promise<WorkspaceData> {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - PULSE_DAYS * DAY_MS).toISOString();

  const [documentsCount, clientsCount, recentDocuments, myClients, pendingProfiles] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("created_at").gte("created_at", since),
    supabase
      .from("clients")
      .select("id, client_name, company_name, created_at, documents(id, file_name, category, thumbnail_path, created_at)")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    profile.role === "admin"
      ? createSupabaseServiceClient()
          .from("profiles")
          .select("full_name", { count: "exact" })
          .eq("status", "pending")
          .neq("email", ADMIN_LOGIN_EMAIL)
          .order("created_at", { ascending: true })
          .limit(3)
      : Promise.resolve(null),
  ]);

  // Day buckets relative to "now" so the last bar is always today.
  const dailyDocuments = Array.from({ length: PULSE_DAYS }, () => 0);
  const now = Date.now();
  for (const row of recentDocuments.data ?? []) {
    const ageDays = Math.floor((now - new Date(row.created_at as string).getTime()) / DAY_MS);
    const index = PULSE_DAYS - 1 - ageDays;
    if (index >= 0 && index < PULSE_DAYS) dailyDocuments[index] += 1;
  }
  const lastWeekDocuments = dailyDocuments.slice(0, 7).reduce((sum, value) => sum + value, 0);
  const thisWeekDocuments = dailyDocuments.slice(7).reduce((sum, value) => sum + value, 0);

  const clientRows = (myClients.data ?? []) as unknown as WorkspaceClientRow[];
  const thumbnailPaths = clientRows.flatMap((row) => (row.documents ?? []).map((document) => document.thumbnail_path)).filter((path): path is string => Boolean(path));
  const urls = await signedUrlsFor(supabase, thumbnailPaths);

  const myRecords = clientRows.map((row): WorkspaceRecord => {
    const documents = [...(row.documents ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const latest = documents[0] ?? null;
    return {
      id: latest?.id ?? row.id,
      company: row.company_name,
      clientName: row.client_name,
      category: latest?.category ?? null,
      fileType: latest ? extensionFromFileName(latest.file_name) : null,
      thumbnailUrl: latest?.thumbnail_path ? (urls.get(latest.thumbnail_path) ?? null) : null,
      documentCount: documents.length,
      date: formatDate(latest?.created_at ?? row.created_at),
      createdAt: latest?.created_at ?? row.created_at,
    };
  });
  const incomplete = myRecords.filter((record) => record.documentCount === 0);

  return {
    totalDocuments: documentsCount.count ?? 0,
    totalClients: clientsCount.count ?? 0,
    dailyDocuments,
    thisWeekDocuments,
    lastWeekDocuments,
    myRecent: myRecords.slice(0, 5),
    myIncomplete: incomplete.slice(0, 3),
    myIncompleteCount: incomplete.length,
    pendingApprovals: pendingProfiles
      ? { count: pendingProfiles.count ?? 0, names: ((pendingProfiles.data ?? []) as { full_name: string }[]).map((row) => row.full_name) }
      : null,
  };
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
