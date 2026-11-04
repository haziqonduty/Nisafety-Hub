-- Run this file in the Supabase SQL Editor.
-- Found during testing: deleting an admin account who had approved at least
-- one staff member failed outright ("Database error deleting user") because
-- profiles.approved_by had no ON DELETE action (defaults to RESTRICT). An
-- admin leaving the company shouldn't block their own account's removal —
-- null the reference out instead, same pattern already used for
-- clients.created_by.

alter table public.profiles drop constraint if exists profiles_approved_by_fkey;
alter table public.profiles
  add constraint profiles_approved_by_fkey
  foreign key (approved_by) references public.profiles(id) on delete set null;
