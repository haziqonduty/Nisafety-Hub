-- Run this file in the Supabase SQL Editor (after 20261114_add_document_service_date.sql).
-- Adds an expiry date to every report: the day the service needs to be done
-- again. The app auto-fills it from the service date + the category's
-- validity period (src/lib/validity.ts) and staff can override it per report,
-- or leave it empty for services with no fixed renewal interval.
--
-- Existing reports are backfilled with the same default periods. KEEP IN
-- SYNC with VALIDITY_RULES in src/lib/validity.ts.

alter table public.documents add column if not exists expiry_date date;

alter table public.documents drop constraint if exists documents_expiry_after_service;
alter table public.documents add constraint documents_expiry_after_service
  check (expiry_date is null or expiry_date > service_date);

update public.documents
set expiry_date = (service_date + make_interval(months => case category
    when 'Chemical Health Risk Assessment (CHRA)' then 60
    when 'Chemical Exposure Monitoring (CEM)' then 6
    when 'Medical Surveillance (MS)' then 12
    when 'Local Exhaust Ventilation (LEV)' then 12
    when 'Noise Risk Assessment (NRA)' then 60
    when 'Audiometric Testing' then 12
    when 'Control of Industrial Major Accident Hazards (CIMAH)' then 36
    when 'Boundary Noise Monitoring' then 3
    when 'Ambient Air Quality Monitoring' then 3
    when 'Environmental Compliance Audit' then 12
    when 'Stack Emission Monitoring' then 12
    when 'Genset Monitoring' then 12
  end))::date
where expiry_date is null
  and category in (
    'Chemical Health Risk Assessment (CHRA)',
    'Chemical Exposure Monitoring (CEM)',
    'Medical Surveillance (MS)',
    'Local Exhaust Ventilation (LEV)',
    'Noise Risk Assessment (NRA)',
    'Audiometric Testing',
    'Control of Industrial Major Accident Hazards (CIMAH)',
    'Boundary Noise Monitoring',
    'Ambient Air Quality Monitoring',
    'Environmental Compliance Audit',
    'Stack Emission Monitoring',
    'Genset Monitoring'
  );

-- The renewals tracker and the homepage banner both scan by expiry date.
create index if not exists documents_expiry_date_idx on public.documents (expiry_date) where expiry_date is not null;
