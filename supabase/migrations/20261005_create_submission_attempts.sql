-- Run this file in the Supabase SQL Editor.
-- Internal abuse-tracking table for rate limiting POST /api/submissions.
-- Not app data — no public access at all; only the service-role key
-- (server-side only, never shipped to the browser) ever touches it.

create table if not exists public.submission_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index if not exists submission_attempts_ip_created_idx on public.submission_attempts (ip_address, created_at);

alter table public.submission_attempts enable row level security;

revoke all on table public.submission_attempts from anon, authenticated;
