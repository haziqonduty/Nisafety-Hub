-- The documents table has carried a 10 MB check on file_size since the
-- first migration (20260921). Reports can now be up to 50 MB (uploaded
-- straight to Storage — see 20261116_raise_report_size_limit.sql), so
-- raise the check to match, or saving a large report's record fails.

alter table public.documents drop constraint if exists documents_file_size_check;

alter table public.documents
  add constraint documents_file_size_check check (file_size > 0 and file_size <= 52428800);
