-- Run this file in the Supabase SQL Editor BEFORE the matching app code is deployed.
-- Service list update (2026-11-24, Kay's request):
--   * "Ergonomic Risk Assessment (ERA)" is split into Initial (IERA) and Advanced (AERA).
--   * "Audiometric Testing" is split into Baseline/Annual and Medical Examination/Diagnostic-PTA.
--   * New services: Noise Control Programme Assessment (NCPA), Chemical Registration,
--     Chemical Classification.
-- Existing reports are re-filed under the most common new type (Kay's decision):
-- ERA -> IERA, Audiometric Testing -> Audiometric (Baseline/Annual). Their
-- expiry dates don't change (Baseline/Annual is still 12 months; IERA has none).
-- KEEP IN SYNC with CATEGORY_GROUPS in src/lib/format.ts.

begin;

alter table public.documents drop constraint if exists documents_category_check;

-- Renames (the format "rename 'old' -> 'new'" below is read by src/lib/validity.test.ts):
-- rename 'Ergonomic Risk Assessment (ERA)' -> 'Initial Ergonomic Risk Assessment (IERA)'
-- rename 'Audiometric Testing' -> 'Audiometric (Baseline/Annual)'
update public.documents set category = 'Initial Ergonomic Risk Assessment (IERA)' where category = 'Ergonomic Risk Assessment (ERA)';
update public.documents set category = 'Audiometric (Baseline/Annual)' where category = 'Audiometric Testing';

update public.clients
set requested_services = array_replace(array_replace(requested_services,
    'Ergonomic Risk Assessment (ERA)', 'Initial Ergonomic Risk Assessment (IERA)'),
    'Audiometric Testing', 'Audiometric (Baseline/Annual)')
where requested_services && array['Ergonomic Risk Assessment (ERA)', 'Audiometric Testing'];

-- `not valid` as before: very old rows may still hold the original 2026-09 categories.
alter table public.documents add constraint documents_category_check check (
  category in (
    -- Industrial Hygiene
    'Chemical Health Risk Assessment (CHRA)',
    'Chemical Exposure Monitoring (CEM)',
    'Medical Surveillance (MS)',
    'Local Exhaust Ventilation (LEV)',
    'Noise Risk Assessment (NRA)',
    'Noise Control Programme Assessment (NCPA)',
    'Audiometric (Baseline/Annual)',
    'Audiometric (Medical Examination/Diagnostic-PTA)',
    'Initial Ergonomic Risk Assessment (IERA)',
    'Advanced Ergonomic Risk Assessment (AERA)',
    'Hazard Identification, Risk Assessment and Risk Control (HIRARC)',
    'Indoor Air Quality (IAQ) Testing',
    'Control of Industrial Major Accident Hazards (CIMAH)',
    'Psychosocial Assessment',
    'Chemical Registration',
    'Chemical Classification',
    -- Environmental Monitoring
    'Boundary Noise Monitoring',
    'Ambient Air Quality Monitoring',
    'Environmental Compliance Audit',
    'Drinking Water Analysis',
    'DOE Written Notification (WN) & Written Declaration (WD)',
    'Stack Emission Monitoring',
    'Genset Monitoring',
    'Waste Water Analysis',
    'Scheduled Waste Testing'
  )
) not valid;

-- There are now 25 services, so a client asking for all of them must fit.
-- KEEP IN SYNC with MAX_REQUESTED_SERVICES in src/lib/requested-services.ts.
alter table public.clients drop constraint if exists clients_requested_services_check;
alter table public.clients
  add constraint clients_requested_services_check check (cardinality(requested_services) <= 30);

commit;
