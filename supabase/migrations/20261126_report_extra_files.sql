-- Run this file in the Supabase SQL Editor BEFORE the matching app code is deployed.
-- More than one document per service report (2026-11-26, Kay's request).
--
-- A report keeps its main file on `documents` as before (so expiry,
-- renewals, thumbnails and the directory are unchanged). Each file now
-- carries a name/remark staff type in ("Main report", "Appendix A", ...):
--   * documents.file_label    — the main file's name (null on older reports)
--   * public.document_files   — the extra files, each with its own label
-- KEEP IN SYNC with MAX_FILES_PER_REPORT / MAX_FILE_LABEL_LENGTH in
-- src/lib/report-files.ts.
-- No existing data is changed.

begin;

alter table public.documents add column if not exists file_label text;
alter table public.documents drop constraint if exists documents_file_label_length;
alter table public.documents add constraint documents_file_label_length
  check (file_label is null or char_length(file_label) between 1 and 120);

create table if not exists public.document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  file_type text not null,
  file_size bigint not null check (file_size > 0),
  position smallint not null default 1 check (position between 1 and 9),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists document_files_document_idx on public.document_files (document_id, position);

-- At most 9 extra files per report (10 documents in total).
create or replace function public.document_files_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.document_files where document_id = new.document_id) >= 9 then
    raise exception 'A report can have at most 10 documents.';
  end if;
  return new;
end;
$$;

drop trigger if exists document_files_limit on public.document_files;
create trigger document_files_limit
  before insert on public.document_files
  for each row execute function public.document_files_limit();

alter table public.document_files enable row level security;

-- Staff see and add extra files only on reports they can see (approved
-- staff, report not in the recycle bin). Deleting goes through the server
-- with the service role, like every other file removal.
drop policy if exists "Staff can view document files" on public.document_files;
create policy "Staff can view document files" on public.document_files
  for select to authenticated
  using (
    public.is_approved_staff()
    and exists (select 1 from public.documents d where d.id = document_id and d.deleted_at is null)
  );

drop policy if exists "Staff can add document files" on public.document_files;
create policy "Staff can add document files" on public.document_files
  for insert to authenticated
  with check (
    public.is_approved_staff()
    and exists (select 1 from public.documents d where d.id = document_id and d.deleted_at is null)
  );

revoke all on public.document_files from anon;
grant select, insert on public.document_files to authenticated;

commit;
