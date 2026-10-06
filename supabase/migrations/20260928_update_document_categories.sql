-- Replaces the original 4-category taxonomy with the real Industrial
-- Hygiene / Environmental Monitoring service list. Run this file in the
-- Supabase SQL Editor.
--
-- Added `not valid`: existing rows may still hold the old category values
-- ("Risk assessment", "Inspection report", "Emergency response",
-- "Safety policy") and are left as-is for historical accuracy rather than
-- being remapped onto the new list (there's no clean 1:1 equivalent). The
-- constraint still applies to every new insert or update from this point on.

alter table public.documents drop constraint if exists documents_category_check;

alter table public.documents add constraint documents_category_check check (
  category in (
    -- Industrial Hygiene
    'Chemical Health Risk Assessment (CHRA)',
    'Chemical Exposure Monitoring (CEM)',
    'Medical Surveillance (MS)',
    'Local Exhaust Ventilation (LEV)',
    'Noise Risk Assessment (NRA)',
    'Audiometric Testing',
    'Ergonomic Risk Assessment (ERA)',
    'Hazard Identification, Risk Assessment and Risk Control (HIRARC)',
    'Indoor Air Quality (IAQ) Testing',
    'Control of Industrial Major Accident Hazards (CIMAH)',
    'Psychosocial Assessment',
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
