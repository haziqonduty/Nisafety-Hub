-- There is exactly ONE admin: the built-in "admin" username account
-- (auth email admin@nisafetyhub.internal, see src/lib/auth/admin-account.ts).
-- Nobody — not the app, not the admin, not a service-role script — may give
-- the admin role to any other account. Enforced here so it holds even if the
-- app code is changed or bypassed.

create or replace function public.enforce_single_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.role = 'admin' and not exists (
    select 1 from auth.users u
    where u.id = new.id and lower(u.email) = 'admin@nisafetyhub.internal'
  ) then
    raise exception 'Only the built-in admin account can have the admin role.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_single_admin on public.profiles;
create trigger enforce_single_admin
  before insert or update of role on public.profiles
  for each row execute function public.enforce_single_admin();

-- Demote any account that was promoted before this rule existed.
update public.profiles p
set role = 'staff'
where p.role = 'admin'
  and not exists (
    select 1 from auth.users u
    where u.id = p.id and lower(u.email) = 'admin@nisafetyhub.internal'
  );
