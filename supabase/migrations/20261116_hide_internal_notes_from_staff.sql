-- Internal notes are admin-only.
--
-- Staff (role "authenticated") had a table-level grant on public.clients,
-- so any approved staff member could read and change internal_notes by
-- calling the Supabase REST API directly with their own session, even
-- though the app only ever shows/edits them on admin pages (which use the
-- service role and are unaffected by this).
--
-- Replace the table-level grants with column-level ones that leave out
-- internal_notes. Staff also lose UPDATE on created_by (who submitted the
-- record), which the app never changes.
--
-- NOTE: a column added to clients later is NOT visible to staff until it
-- is granted here explicitly.

revoke select, insert, update on table public.clients from authenticated;

grant select (
  id, client_name, company_name, telephone, email, submitter_name, created_at, created_by,
  additional_client_names, additional_telephones, additional_emails
) on table public.clients to authenticated;

grant insert (
  client_name, company_name, telephone, email, submitter_name, created_by,
  additional_client_names, additional_telephones, additional_emails
) on table public.clients to authenticated;

grant update (
  client_name, company_name, telephone, email, submitter_name,
  additional_client_names, additional_telephones, additional_emails
) on table public.clients to authenticated;
