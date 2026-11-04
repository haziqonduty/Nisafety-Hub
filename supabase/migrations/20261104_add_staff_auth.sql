-- Run this file in the Supabase SQL Editor.
-- Introduces real Supabase Auth accounts with two roles (admin/staff) and an
-- admin-approval gate, replacing the old single-shared-password admin login.
-- Also closes off anonymous public access entirely: the site is no longer
-- public, so anon loses every grant it had on clients/documents/storage.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 160),
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id)
);

alter table public.profiles enable row level security;

-- Security-definer helpers so RLS policies on profiles don't recursively
-- query profiles under RLS themselves (the classic trap).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and status = 'approved'
  );
$$;

-- Auto-create a pending staff profile the moment someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant select, update on table public.profiles to authenticated;

drop policy if exists "Users can view own profile or admins view all" on public.profiles;
create policy "Users can view own profile or admins view all" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- clients/documents: anon loses everything, authenticated+approved gets in.
alter table public.clients add column if not exists created_by uuid references public.profiles(id) on delete set null;

revoke select, insert on table public.clients from anon;
revoke select, insert on table public.documents from anon;

grant select, insert on table public.clients to authenticated;
grant select, insert on table public.documents to authenticated;

drop policy if exists "Public can view clients" on public.clients;
drop policy if exists "Public can submit clients" on public.clients;
drop policy if exists "Staff can view clients" on public.clients;
create policy "Staff can view clients" on public.clients for select to authenticated using (public.is_approved_staff());
drop policy if exists "Staff can submit clients" on public.clients;
create policy "Staff can submit clients" on public.clients for insert to authenticated with check (public.is_approved_staff());

drop policy if exists "Public can view documents" on public.documents;
drop policy if exists "Public can submit documents" on public.documents;
drop policy if exists "Staff can view documents" on public.documents;
create policy "Staff can view documents" on public.documents for select to authenticated using (public.is_approved_staff());
drop policy if exists "Staff can submit documents" on public.documents;
create policy "Staff can submit documents" on public.documents for insert to authenticated with check (public.is_approved_staff());

-- Storage: the bucket itself goes private, and anon's storage policies are
-- replaced with authenticated+approved-staff ones. A public bucket would
-- otherwise let anyone with a direct file URL bypass the login wall entirely.
update storage.buckets set public = false where id = 'safety-documents';

revoke select, insert on storage.objects from anon;

drop policy if exists "Public can view safety documents" on storage.objects;
drop policy if exists "Public can upload safety documents" on storage.objects;

drop policy if exists "Staff can view safety documents" on storage.objects;
create policy "Staff can view safety documents" on storage.objects for select to authenticated using (
  bucket_id = 'safety-documents' and public.is_approved_staff()
);

drop policy if exists "Staff can upload safety documents" on storage.objects;
create policy "Staff can upload safety documents" on storage.objects for insert to authenticated with check (
  bucket_id = 'safety-documents'
  and public.is_approved_staff()
  and (storage.foldername(name))[1] = 'submissions'
  and (
    lower(storage.extension(name)) in ('pdf', 'doc', 'docx')
    or name like '%.thumb.jpg'
  )
);
