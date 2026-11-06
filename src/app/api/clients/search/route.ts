import { requireApprovedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RESULT_LIMIT = 8;

// How many of the most recent clients to consider per search. Matching is
// done in JS (below) rather than a DB-side ilike filter because the term can
// also match inside the additional_* array columns, which PostgREST can't
// substring-match directly. Mirrors the same bounded-fetch-then-filter
// approach getDirectoryDocuments()/the directory search already use.
const CANDIDATE_LIMIT = 300;

type ClientRow = {
  id: string;
  client_name: string;
  company_name: string;
  telephone: string;
  email: string;
  submitter_name: string;
  additional_client_names: string[] | null;
  additional_telephones: string[] | null;
  additional_emails: string[] | null;
};

export async function GET(request: Request) {
  const profile = await requireApprovedProfile();
  if (!profile) {
    return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const rawQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length < 2) {
    return Response.json({ clients: [] });
  }

  const needle = rawQuery.toLowerCase().slice(0, 100);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, client_name, company_name, telephone, email, submitter_name, additional_client_names, additional_telephones, additional_emails",
    )
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  if (error || !data) {
    return Response.json({ clients: [] });
  }

  const matches = (data as ClientRow[]).filter((row) =>
    [
      row.company_name,
      row.client_name,
      row.telephone,
      row.email,
      ...(row.additional_client_names ?? []),
      ...(row.additional_telephones ?? []),
      ...(row.additional_emails ?? []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );

  const clients = matches.slice(0, RESULT_LIMIT).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    companyName: row.company_name,
    telephone: row.telephone,
    email: row.email,
    submitterName: row.submitter_name,
  }));

  return Response.json({ clients });
}
