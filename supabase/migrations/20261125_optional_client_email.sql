-- Run this file in the Supabase SQL Editor BEFORE the matching app code is deployed.
-- Client email becomes optional (2026-11-25, Kay's request).
--
-- An empty string means "no email" (the column stays NOT NULL so the app
-- never has to handle null). A real address must still look like one.
-- The "no-email@example.com" placeholder staff used while email was
-- mandatory is cleared, so those clients now simply show "No email".

begin;

alter table public.clients drop constraint if exists clients_email_check;
alter table public.clients add constraint clients_email_check
  check (email = '' or char_length(email) between 3 and 254);

update public.clients
set email = ''
where lower(btrim(email)) = 'no-email@example.com';

update public.clients
set additional_emails = array(
  select e from unnest(additional_emails) e where lower(btrim(e)) <> 'no-email@example.com'
)
where exists (select 1 from unnest(additional_emails) e where lower(btrim(e)) = 'no-email@example.com');

commit;
