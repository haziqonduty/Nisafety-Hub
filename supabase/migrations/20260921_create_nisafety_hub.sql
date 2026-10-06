-- Run this file in the Supabase SQL Editor before using the submission API.
-- Public records are intentionally readable. Public contributors can insert,
-- but cannot update or delete records through the Data API.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 1 and 160),
  company_name text not null check (char_length(company_name) between 1 and 160),
  telephone text not null check (char_length(telephone) between 1 and 40),
  email text not null check (char_length(email) between 3 and 254),
  submitter_name text not null check (char_length(submitter_name) between 1 and 160),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  category text not null check (category in ('Risk assessment', 'Inspection report', 'Emergency response', 'Safety policy')),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  file_type text not null check (file_type in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists clients_company_name_idx on public.clients (company_name);
create index if not exists clients_client_name_idx on public.clients (client_name);
create index if not exists documents_category_idx on public.documents (category);

alter table public.clients enable row level security;
alter table public.documents enable row level security;

revoke all on table public.clients from anon, authenticated;
revoke all on table public.documents from anon, authenticated;
grant select, insert on table public.clients to anon;
grant select, insert on table public.documents to anon;

drop policy if exists "Public can view clients" on public.clients;
create policy "Public can view clients" on public.clients for select to anon using (true);
drop policy if exists "Public can submit clients" on public.clients;
create policy "Public can submit clients" on public.clients for insert to anon with check (true);

drop policy if exists "Public can view documents" on public.documents;
create policy "Public can view documents" on public.documents for select to anon using (true);
drop policy if exists "Public can submit documents" on public.documents;
create policy "Public can submit documents" on public.documents for insert to anon with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'safety-documents',
  'safety-documents',
  true,
  10485760,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant select, insert on storage.objects to anon;
drop policy if exists "Public can view safety documents" on storage.objects;
create policy "Public can view safety documents" on storage.objects for select to anon using (bucket_id = 'safety-documents');
drop policy if exists "Public can upload safety documents" on storage.objects;
create policy "Public can upload safety documents" on storage.objects for insert to anon with check (
  bucket_id = 'safety-documents'
  and (storage.foldername(name))[1] = 'submissions'
  and lower(storage.extension(name)) in ('pdf', 'doc', 'docx')
);
