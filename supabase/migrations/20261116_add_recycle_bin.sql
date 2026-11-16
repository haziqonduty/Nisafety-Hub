-- Recycle bin: deleting a client or report moves it to a bin for 30 days
-- instead of erasing it, so an admin can restore a mistaken delete.
--
-- A row is "in the bin" when deleted_at is set. Staff policies below hide
-- binned rows everywhere (directory, search, renewals, record pages,
-- analytics), because every staff page reads through these policies. Only
-- the admin recycle bin (service role) sees them. Rows older than 30 days
-- are permanently removed by the app, together with their files.

alter table public.clients
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.documents
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists clients_deleted_at_idx on public.clients (deleted_at) where deleted_at is not null;
create index if not exists documents_deleted_at_idx on public.documents (deleted_at) where deleted_at is not null;

-- clients uses column-level grants (internal notes are admin-only); the
-- policies below reference deleted_at, so staff need to be able to read it.
-- They only ever see rows where it's null.
grant select (deleted_at) on table public.clients to authenticated;

-- Staff: read and edit only rows that aren't in the bin, and never put a
-- row into (or take it out of) the bin themselves — only admins can, via
-- the app's admin routes.
drop policy if exists "Staff can view clients" on public.clients;
create policy "Staff can view clients" on public.clients
  for select to authenticated
  using (public.is_approved_staff() and deleted_at is null);

drop policy if exists "Staff can update clients" on public.clients;
create policy "Staff can update clients" on public.clients
  for update to authenticated
  using (public.is_approved_staff() and deleted_at is null)
  with check (public.is_approved_staff() and deleted_at is null);

drop policy if exists "Staff can view documents" on public.documents;
create policy "Staff can view documents" on public.documents
  for select to authenticated
  using (public.is_approved_staff() and deleted_at is null);

drop policy if exists "Staff can update documents" on public.documents;
create policy "Staff can update documents" on public.documents
  for update to authenticated
  using (public.is_approved_staff() and deleted_at is null)
  with check (public.is_approved_staff() and deleted_at is null);

drop policy if exists "Staff can submit documents" on public.documents;
create policy "Staff can submit documents" on public.documents
  for insert to authenticated
  with check (public.is_approved_staff() and deleted_at is null);
