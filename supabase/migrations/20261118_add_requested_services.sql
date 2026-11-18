-- Services a client needs, recorded without a report.
--
-- "No, client details only" on the New report page used to skip services
-- completely. Staff can now tick which services the client wants (no date,
-- no expiry tracking). A service drops off this list in the app as soon as a
-- real report for it is added.
--
-- Values are the same category names used by documents.category. Staff
-- access to public.clients is column-by-column (see
-- 20261116_hide_internal_notes_from_staff.sql), so the new column is granted
-- explicitly.

alter table public.clients
  add column if not exists requested_services text[] not null default '{}';

alter table public.clients
  drop constraint if exists clients_requested_services_check;
alter table public.clients
  add constraint clients_requested_services_check check (cardinality(requested_services) <= 20);

grant select (requested_services), insert (requested_services), update (requested_services)
  on table public.clients to authenticated;
