-- Run this file in the Supabase SQL Editor.
-- Adds the day a service was actually carried out to every report. Until now
-- the only date was created_at (the upload time), which is wrong whenever a
-- report is uploaded days after the site visit, and can't express "these
-- three services were done on the same visit".
--
-- Existing reports are backfilled with their upload day (Malaysia time) —
-- the best information available — and can be corrected from the record
-- page's Edit form.

alter table public.documents add column if not exists service_date date;

update public.documents
set service_date = (created_at at time zone 'Asia/Kuala_Lumpur')::date
where service_date is null;

alter table public.documents
  alter column service_date set default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  alter column service_date set not null;

-- Client service history is always read as "this client's reports, newest
-- visit first".
create index if not exists documents_client_service_date_idx on public.documents (client_id, service_date desc);
