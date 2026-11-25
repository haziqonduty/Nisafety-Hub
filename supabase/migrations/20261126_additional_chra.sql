-- Run this file in the Supabase SQL Editor BEFORE the matching app code is deployed.
-- New service (2026-11-26, Kay's request):
--   * Additional Chemical Health Risk Assessment (Add.CHRA) — Industrial Hygiene,
--     right after CHRA, 5-year expiry like CHRA (and like Add.NRA)
-- New service only: no existing report or client is changed. (LUBRIMAX's
-- Additional CHRA is re-filed separately, only with Kay's OK.)
-- KEEP IN SYNC with CATEGORY_GROUPS in src/lib/format.ts.

begin;

alter table public.documents drop constraint if exists documents_category_check;

-- `not valid` as before: very old rows may still hold the original 2026-09 categories.
alter table public.documents add constraint documents_category_check check (
  category in (
    -- Industrial Hygiene
    'Chemical Health Risk Assessment (CHRA)',
    'Additional Chemical Health Risk Assessment (Add.CHRA)',
    'Chemical Exposure Monitoring (CEM)',
    'Medical Surveillance (MS)',
    'Local Exhaust Ventilation (LEV)',
    'Noise Risk Assessment (NRA)',
    'Additional Noise Risk Assessment (Add.NRA)',
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
    'Scheduled Waste Testing',
    -- Training
    'Training'
  )
) not valid;

commit;
