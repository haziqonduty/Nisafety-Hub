-- Run this file in the Supabase SQL Editor BEFORE the matching app code is deployed.
-- Kay's request (2026-11-25): Chemical Exposure Monitoring (CEM) and Boundary
-- Noise Monitoring now default to a 1-year validity (were 6 and 3 months).
--
-- CEM note: USECHH reg. 26(2) still requires monitoring at least every
-- 6 months for Schedule II chemicals; staff set that expiry by hand on those
-- reports. Otherwise the interval is the one set in the CHRA, commonly yearly.
--
-- Only reports still carrying the OLD automatic expiry are moved; any expiry
-- a staff member typed in by hand is left alone.
-- KEEP IN SYNC with VALIDITY_RULES in src/lib/validity.ts. The lines below in
-- the form "interval 'category' -> months" are read by src/lib/validity.test.ts:
-- interval 'Chemical Exposure Monitoring (CEM)' -> 12
-- interval 'Boundary Noise Monitoring' -> 12

begin;

update public.documents
set expiry_date = (service_date + interval '12 months')::date
where category = 'Chemical Exposure Monitoring (CEM)'
  and expiry_date = (service_date + interval '6 months')::date;

update public.documents
set expiry_date = (service_date + interval '12 months')::date
where category = 'Boundary Noise Monitoring'
  and expiry_date = (service_date + interval '3 months')::date;

commit;
