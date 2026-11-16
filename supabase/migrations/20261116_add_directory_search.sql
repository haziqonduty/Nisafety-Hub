-- Server-side directory search + paging.
--
-- The directory used to load the newest 200 documents/clients and filter
-- them in the browser, so anything older silently disappeared from both the
-- directory and search. This returns one page of matching CLIENT ids
-- (newest activity first) plus the total match count; the app then loads
-- just those clients and their reports.
--
-- SECURITY INVOKER: runs with the caller's own RLS, so only approved staff
-- see anything (same as querying the tables directly).
--
-- Matching uses position() rather than LIKE so characters like % and _ in
-- the search text are taken literally.

create or replace function public.directory_search(
  search text default '',
  category_filter text default null,
  page_limit integer default 24,
  page_offset integer default 0
)
returns table (client_id uuid, last_activity timestamptz, total_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with activity as (
    select
      c.id,
      greatest(c.created_at, coalesce(max(d.created_at), c.created_at)) as last_activity,
      lower(concat_ws(' ',
        c.client_name, c.company_name, c.telephone, c.email,
        array_to_string(c.additional_client_names, ' '),
        array_to_string(c.additional_telephones, ' '),
        array_to_string(c.additional_emails, ' '),
        string_agg(d.file_name || ' ' || d.category, ' ')
      )) as haystack,
      coalesce(bool_or(d.category = category_filter), false) as has_category
    from public.clients c
    left join public.documents d on d.client_id = c.id
    group by c.id
  ),
  matched as (
    select id, last_activity
    from activity
    where (coalesce(btrim(search), '') = '' or position(lower(btrim(search)) in haystack) > 0)
      and (category_filter is null or has_category)
  )
  select id, last_activity, count(*) over ()
  from matched
  order by last_activity desc, id
  limit least(greatest(page_limit, 1), 100)
  offset greatest(page_offset, 0);
$$;

revoke all on function public.directory_search(text, text, integer, integer) from public, anon;
grant execute on function public.directory_search(text, text, integer, integer) to authenticated;
