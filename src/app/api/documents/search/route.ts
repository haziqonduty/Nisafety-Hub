import { getDirectoryDocuments } from "@/lib/supabase/queries";

const RESULT_LIMIT = 8;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const documents = await getDirectoryDocuments();

  const matches = query
    ? documents.filter((document) =>
        `${document.title} ${document.company} ${document.category ?? ""} ${document.clientName} ${document.telephone} ${document.email}`
          .toLowerCase()
          .includes(query),
      )
    : documents;

  const results = matches.slice(0, RESULT_LIMIT).map((document) => ({
    id: document.id,
    title: document.title,
    company: document.company,
    category: document.category,
    fileType: document.fileType,
  }));

  return Response.json({ results });
}
