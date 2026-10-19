-- Run this file in the Supabase SQL Editor.
-- Adds an admin-only internal notes field on clients (e.g. "called to
-- confirm renewal, follow up next month") — never shown publicly.
--
-- RLS policies control row visibility, not columns, and `anon` currently
-- has a blanket table-level grant (`grant select, insert on ... to anon`
-- from the original migration), which would make a new column publicly
-- readable/writable by default. Replacing it with an explicit column list
-- is what actually keeps internal_notes private — the admin API already
-- uses the service-role client, which bypasses grants entirely.

alter table public.clients add column if not exists internal_notes text check (char_length(internal_notes) <= 2000);

revoke select, insert on table public.clients from anon;

grant select (id, client_name, company_name, telephone, email, submitter_name, created_at)
  on table public.clients to anon;

grant insert (client_name, company_name, telephone, email, submitter_name)
  on table public.clients to anon;
