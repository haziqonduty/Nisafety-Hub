import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/server";
import { extensionFromFileName, formatDate, formatFileSize, titleFromFileName, toneForCategory } from "@/lib/format";

const DIRECTORY_LIMIT = 200;

function publicUrlFor(supabase: SupabaseClient, storagePath: string) {
  return supabase.storage.from("safety-documents").getPublicUrl(storagePath).data.publicUrl;
}

export type DirectoryDocument = {
  id: string;
  hasDocument: boolean;
  title: string;
  company: string;
  clientName: string;
  telephone: string;
  email: string;
  category: string | null;
  fileType: string | null;
  fileSize: string | null;
  storagePath: string | null;
  publicUrl: string | null;
  date: string;
  tone: ReturnType<typeof toneForCategory> | null;
};

type ClientSummary = { client_name: string; company_name: string; telephone: string; email: string };

type DocumentRow = {
  id: string;
  category: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  clients: ClientSummary | ClientSummary[] | null;
};

const UNKNOWN_CLIENT: ClientSummary = { client_name: "Unknown client", company_name: "Unknown organisation", telephone: "", email: "" };

function clientSummary(clients: DocumentRow["clients"]): ClientSummary {
  if (!clients) return UNKNOWN_CLIENT;
  return Array.isArray(clients) ? (clients[0] ?? UNKNOWN_CLIENT) : clients;
}

function toDirectoryDocument(supabase: SupabaseClient, row: DocumentRow): DirectoryDocument {
  const client = clientSummary(row.clients);
  return {
    id: row.id,
    hasDocument: true,
    title: titleFromFileName(row.file_name),
    company: client.company_name,
    clientName: client.client_name,
    telephone: client.telephone,
    email: client.email,
    category: row.category,
    fileType: extensionFromFileName(row.file_name),
    fileSize: formatFileSize(row.file_size),
    storagePath: row.storage_path,
    publicUrl: publicUrlFor(supabase, row.storage_path),
    date: formatDate(row.created_at),
    tone: toneForCategory(row.category),
  };
}

type ClientOnlyRow = {
  id: string;
  client_name: string;
  company_name: string;
  telephone: string;
  email: string;
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
    category: null,
    fileType: null,
    fileSize: null,
    storagePath: null,
    publicUrl: null,
    date: formatDate(row.created_at),
    tone: null,
  };
}

export async function getDirectoryDocuments(): Promise<DirectoryDocument[]> {
  const supabase = createSupabaseClient();

  const [documentsResult, clientsResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id, category, file_name, file_size, storage_path, created_at, clients(client_name, company_name, telephone, email)")
      .order("created_at", { ascending: false })
      .limit(DIRECTORY_LIMIT),
    supabase
      .from("clients")
      .select("id, client_name, company_name, telephone, email, created_at, documents(id)")
      .order("created_at", { ascending: false })
      .limit(DIRECTORY_LIMIT),
  ]);

  const documentRows = (documentsResult.data ?? []) as unknown as DocumentRow[];
  const clientOnlyRows = ((clientsResult.data ?? []) as unknown as ClientOnlyRow[]).filter((row) => (row.documents?.length ?? 0) === 0);

  const combined = [
    ...documentRows.map((row) => ({ sortKey: row.created_at, document: toDirectoryDocument(supabase, row) })),
    ...clientOnlyRows.map((row) => ({ sortKey: row.created_at, document: toClientOnlyDirectoryDocument(row) })),
  ];

  return combined
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
    .slice(0, DIRECTORY_LIMIT)
    .map((entry) => entry.document);
}

export type RecordDetail = {
  id: string;
  hasDocument: boolean;
  clientName: string;
  companyName: string;
  telephone: string;
  email: string;
  submitterName: string;
  category: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: string | null;
  storagePath: string | null;
  publicUrl: string | null;
  date: string;
  tone: ReturnType<typeof toneForCategory> | null;
};

type RecordDetailRow = {
  id: string;
  category: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  clients: {
    client_name: string;
    company_name: string;
    telephone: string;
    email: string;
    submitter_name: string;
  } | {
    client_name: string;
    company_name: string;
    telephone: string;
    email: string;
    submitter_name: string;
  }[] | null;
};

async function getDocumentRecordById(id: string): Promise<RecordDetail | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, category, file_name, file_size, storage_path, created_at, clients(client_name, company_name, telephone, email, submitter_name)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as RecordDetailRow;
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  if (!client) return null;

  return {
    id: row.id,
    hasDocument: true,
    clientName: client.client_name,
    companyName: client.company_name,
    telephone: client.telephone,
    email: client.email,
    submitterName: client.submitter_name,
    category: row.category,
    fileName: row.file_name,
    fileType: extensionFromFileName(row.file_name),
    fileSize: formatFileSize(row.file_size),
    storagePath: row.storage_path,
    publicUrl: publicUrlFor(supabase, row.storage_path),
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
  created_at: string;
};

async function getClientOnlyRecordById(id: string): Promise<RecordDetail | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_name, company_name, telephone, email, submitter_name, created_at")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as ClientOnlyRecordRow;
  return {
    id: row.id,
    hasDocument: false,
    clientName: row.client_name,
    companyName: row.company_name,
    telephone: row.telephone,
    email: row.email,
    submitterName: row.submitter_name,
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

type AnalyticsDocumentRow = {
  id: string;
  category: string;
  created_at: string;
  clients: { company_name: string } | { company_name: string }[] | null;
};

export async function getAdminAnalyticsData() {
  const supabase = createSupabaseClient();

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
  created_at: string;
  documents: { id: string; category: string; file_name: string }[] | null;
};

export async function getAdminClients(): Promise<AdminClient[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_name, company_name, telephone, email, submitter_name, created_at, documents(id, category, file_name)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as AdminClientRow[]).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    companyName: row.company_name,
    telephone: row.telephone,
    email: row.email,
    submitterName: row.submitter_name,
    date: formatDate(row.created_at),
    createdAt: row.created_at,
    documents: (row.documents ?? []).map((document) => ({
      id: document.id,
      category: document.category,
      fileName: document.file_name,
    })),
  }));
}
