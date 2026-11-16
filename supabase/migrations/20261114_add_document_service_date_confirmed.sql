-- Date of monitoring must be keyed in by staff, not assumed.
--
-- Every report that already exists got its service_date automatically
-- (backfilled from the upload time, or the form's old "today" default), so
-- they all start as NOT confirmed. Staff confirm the real date from the
-- record page, which also recalculates the expiry from it.
--
-- New reports can only be saved with a date staff picked, so the column
-- default flips to true AFTER the existing rows have been marked false.

alter table public.documents
  add column if not exists service_date_confirmed boolean not null default false;

alter table public.documents
  alter column service_date_confirmed set default true;

-- Unconfirmed reports are listed for follow-up; keep that lookup cheap.
create index if not exists documents_service_date_unconfirmed_idx
  on public.documents (service_date)
  where service_date_confirmed = false;
