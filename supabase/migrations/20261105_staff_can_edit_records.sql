-- Run this file in the Supabase SQL Editor.
-- Lets any approved staff member (not just admin) edit an existing client or
-- document record, and attach/replace a document after the fact. Reuses the
-- is_approved_staff() helper already defined in 20261104_add_staff_auth.sql.

grant update on table public.clients to authenticated;

drop policy if exists "Staff can update clients" on public.clients;
create policy "Staff can update clients" on public.clients
  for update to authenticated
  using (public.is_approved_staff())
  with check (public.is_approved_staff());

grant update on table public.documents to authenticated;

drop policy if exists "Staff can update documents" on public.documents;
create policy "Staff can update documents" on public.documents
  for update to authenticated
  using (public.is_approved_staff())
  with check (public.is_approved_staff());
