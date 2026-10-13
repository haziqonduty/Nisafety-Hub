-- Run this file in the Supabase SQL Editor.
-- Adds an optional first-page thumbnail for PDF documents, shown in the
-- public directory grid. Nullable — existing rows and non-PDF documents
-- simply have no thumbnail and fall back to the existing badge/icon UI.

alter table public.documents add column if not exists thumbnail_path text;
