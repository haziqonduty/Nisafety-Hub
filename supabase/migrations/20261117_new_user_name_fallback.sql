-- Creating an account without a name failed with "Database error creating
-- new user": the profile's full_name must be 1-160 characters, but the
-- trigger fell back to an empty string. Sign-up always sends a name, so this
-- only hit accounts added from the Supabase dashboard.
--
-- Now: use the given name (trimmed, max 160), or fall back to the part of
-- the email before "@". Behaviour is otherwise unchanged (new accounts are
-- still pending staff).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'New staff'), 160),
    new.email
  );
  return new;
end;
$$;
