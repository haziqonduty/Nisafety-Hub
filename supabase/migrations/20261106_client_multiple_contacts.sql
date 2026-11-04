-- Run this file in the Supabase SQL Editor.
-- Lets a report have more than one contact name, telephone number, or email
-- address (e.g. two contact persons for one company). The existing
-- client_name/telephone/email columns stay mandatory and unchanged — these
-- are purely optional extras alongside them.

alter table public.clients
  add column if not exists additional_client_names text[] not null default '{}',
  add column if not exists additional_telephones text[] not null default '{}',
  add column if not exists additional_emails text[] not null default '{}';

alter table public.clients drop constraint if exists additional_client_names_limit;
alter table public.clients add constraint additional_client_names_limit check (cardinality(additional_client_names) <= 4);

alter table public.clients drop constraint if exists additional_telephones_limit;
alter table public.clients add constraint additional_telephones_limit check (cardinality(additional_telephones) <= 4);

alter table public.clients drop constraint if exists additional_emails_limit;
alter table public.clients add constraint additional_emails_limit check (cardinality(additional_emails) <= 4);
