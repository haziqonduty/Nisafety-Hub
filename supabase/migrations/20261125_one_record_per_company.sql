-- Run this file in the Supabase SQL Editor BEFORE the matching app code is deployed.
-- One record per company (2026-11-25, Kay's request).
--
-- Staff sometimes typed a company in again for a new service instead of
-- picking it from the search, so the same company was saved as two client
-- records (e.g. one record per report). From now on:
--   * a new report or "client details only" for a company that already
--     exists is added to THAT record (the app calls find_client_by_company);
--   * a different contact name / phone / email is kept as an extra contact.
-- This file also merges the duplicates that already exist.
--
-- "Same company" = same letters and digits, ignoring case, spaces and
-- punctuation ("Acme Sdn. Bhd." = "ACME SDN BHD").
-- KEEP IN SYNC with companyMatchKey() in src/lib/client-merge.ts.

begin;

-- 1. Room for more contacts per company (was 4 extra of each).
-- KEEP IN SYNC with MAX_ADDITIONAL_CONTACTS in src/lib/client-merge.ts.
alter table public.clients drop constraint if exists additional_client_names_limit;
alter table public.clients add constraint additional_client_names_limit check (cardinality(additional_client_names) <= 10);
alter table public.clients drop constraint if exists additional_telephones_limit;
alter table public.clients add constraint additional_telephones_limit check (cardinality(additional_telephones) <= 10);
alter table public.clients drop constraint if exists additional_emails_limit;
alter table public.clients add constraint additional_emails_limit check (cardinality(additional_emails) <= 10);

-- 2. Matching a company by name.
create or replace function public.company_match_key(name text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g');
$$;

create index if not exists clients_company_match_key_idx
  on public.clients (public.company_match_key(company_name))
  where deleted_at is null;

-- The oldest live record for that company, or null. SECURITY INVOKER: staff
-- only ever see what RLS already lets them see.
create or replace function public.find_client_by_company(company text)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from public.clients c
  where c.deleted_at is null
    and public.company_match_key(c.company_name) = public.company_match_key(company)
    and public.company_match_key(company) <> ''
  order by c.created_at asc, c.id
  limit 1;
$$;

revoke all on function public.find_client_by_company(text) from public, anon;
grant execute on function public.find_client_by_company(text) to authenticated;

-- 3. Merge the duplicates that already exist. The OLDEST record of each
-- company is kept; every report of the others moves onto it, their contact
-- names / phones / emails become extra contacts (no repeats; the
-- no-email@example.com placeholder is skipped), requested services and
-- internal notes are combined, and the kept record takes a pinned map
-- location if it had none. The emptied records are then removed
-- (documents.client_id is ON DELETE RESTRICT, so this fails safely if a
-- report were ever left behind).
do $$
declare
  grp record;
  keep public.clients;
  dup public.clients;
  v text;
  names text[];
  phones text[];
  emails text[];
  services text[];
  notes text;
begin
  for grp in
    select public.company_match_key(company_name) as k
    from public.clients
    where deleted_at is null and public.company_match_key(company_name) <> ''
    group by 1
    having count(*) > 1
  loop
    select * into keep
    from public.clients
    where deleted_at is null and public.company_match_key(company_name) = grp.k
    order by created_at asc, id
    limit 1;

    names := keep.additional_client_names;
    phones := keep.additional_telephones;
    emails := keep.additional_emails;
    services := keep.requested_services;
    notes := keep.internal_notes;

    for dup in
      select * from public.clients
      where deleted_at is null and public.company_match_key(company_name) = grp.k and id <> keep.id
      order by created_at asc, id
    loop
      update public.documents set client_id = keep.id where client_id = dup.id;

      foreach v in array (array[dup.client_name] || dup.additional_client_names) loop
        v := btrim(v);
        if v <> '' and upper(v) <> upper(btrim(keep.client_name))
           and not exists (select 1 from unnest(names) n where upper(btrim(n)) = upper(v)) then
          names := names || v;
        end if;
      end loop;

      foreach v in array (array[dup.telephone] || dup.additional_telephones) loop
        v := btrim(v);
        if regexp_replace(v, '\D', '', 'g') <> '' and regexp_replace(v, '\D', '', 'g') <> regexp_replace(keep.telephone, '\D', '', 'g')
           and not exists (select 1 from unnest(phones) p where regexp_replace(p, '\D', '', 'g') = regexp_replace(v, '\D', '', 'g')) then
          phones := phones || v;
        end if;
      end loop;

      foreach v in array (array[dup.email] || dup.additional_emails) loop
        v := lower(btrim(v));
        if v <> '' and v <> 'no-email@example.com' and v <> lower(btrim(keep.email))
           and not exists (select 1 from unnest(emails) e where lower(btrim(e)) = v) then
          emails := emails || v;
        end if;
      end loop;

      foreach v in array dup.requested_services loop
        if not (v = any(services)) then
          services := services || v;
        end if;
      end loop;

      if nullif(btrim(dup.internal_notes), '') is not null then
        notes := concat_ws(E'\n', nullif(btrim(notes), ''), btrim(dup.internal_notes));
      end if;

      if keep.latitude is null and dup.latitude is not null then
        keep.latitude := dup.latitude;
        keep.longitude := dup.longitude;
        keep.location_label := dup.location_label;
        keep.location_updated_at := dup.location_updated_at;
        keep.location_updated_by := dup.location_updated_by;
      end if;

      delete from public.clients where id = dup.id;
    end loop;

    update public.clients
    set additional_client_names = names[1:10],
        additional_telephones = phones[1:10],
        additional_emails = emails[1:10],
        requested_services = services[1:30],
        internal_notes = left(notes, 2000),
        latitude = keep.latitude,
        longitude = keep.longitude,
        location_label = keep.location_label,
        location_updated_at = keep.location_updated_at,
        location_updated_by = keep.location_updated_by
    where id = keep.id;
  end loop;
end $$;

commit;
