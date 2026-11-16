-- Client site location, for the live client map (/map).
--
-- Staff place each client on the map themselves (search a place, then click
-- or drag the pin), so the coordinates are exactly where the site is — many
-- clients are estates/factories with no clean street address.
--
-- latitude/longitude are both set or both empty. The bounds are a generous
-- box around Malaysia (incl. Sabah/Sarawak, Singapore and Brunei), so a slip
-- of the mouse can't put a client in the middle of the ocean far away.

alter table public.clients
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_label text check (char_length(location_label) <= 200),
  add column if not exists location_updated_at timestamptz,
  add column if not exists location_updated_by uuid references public.profiles(id) on delete set null;

alter table public.clients drop constraint if exists clients_location_pair_check;
alter table public.clients add constraint clients_location_pair_check check (
  (latitude is null and longitude is null)
  or (latitude between -1 and 9 and longitude between 98 and 121)
);

-- Column-level grants (see 20261116_hide_internal_notes_from_staff.sql):
-- new columns are invisible to staff until granted here.
grant select (latitude, longitude, location_label, location_updated_at, location_updated_by)
  on table public.clients to authenticated;
grant update (latitude, longitude, location_label, location_updated_at, location_updated_by)
  on table public.clients to authenticated;
