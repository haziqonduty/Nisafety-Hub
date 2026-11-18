-- Directory search: also match a client's REQUESTED services.
--
-- Bug (2026-11-18): a client saved with "client details only" + CHRA as a
-- requested service did not appear when filtering by CHRA, or when typing
-- "CHRA" in the search box, because directory_page only looked at the
-- categories of attached reports. Now the category filter and the search
-- text both include clients.requested_services.
--
-- Same function, same signature, same grants; only these two lines changed.

create or replace function public.directory_page(
  search text default '',
  category_filter text default null,
  status_filter text default null,
  sort_by text default 'recent',
  page_limit integer default 24,
  page_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with today as (
    select (now() at time zone 'Asia/Kuala_Lumpur')::date as d
  ),
  live_docs as (
    select d.id, d.client_id, d.category, d.file_name, d.service_date, d.expiry_date, d.created_at
    from public.documents d
    where d.deleted_at is null
  ),
  latest as (
    select distinct on (d.client_id, d.category) d.client_id, d.expiry_date
    from live_docs d
    order by d.client_id, d.category, d.service_date desc, d.created_at desc
  ),
  health as (
    select l.client_id, min(l.expiry_date) as next_expiry
    from latest l
    group by l.client_id
  ),
  activity as (
    select
      c.id,
      c.company_name,
      c.client_name,
      c.created_at,
      greatest(c.created_at, coalesce(max(d.created_at), c.created_at)) as last_activity,
      count(d.id) as report_count,
      lower(concat_ws(' ',
        c.client_name, c.company_name, c.telephone, c.email,
        array_to_string(c.additional_client_names, ' '),
        array_to_string(c.additional_telephones, ' '),
        array_to_string(c.additional_emails, ' '),
        array_to_string(c.requested_services, ' '),
        string_agg(d.file_name || ' ' || d.category, ' ')
      )) as haystack,
      coalesce(bool_or(d.category = category_filter), false)
        or category_filter = any(c.requested_services) as has_category
    from public.clients c
    left join live_docs d on d.client_id = c.id
    where c.deleted_at is null
    group by c.id
  ),
  scoped as (
    select
      a.id,
      a.company_name,
      a.client_name,
      a.created_at,
      a.last_activity,
      h.next_expiry,
      case
        when a.report_count = 0 then 'no_report'
        when h.next_expiry is null then 'none'
        when h.next_expiry < t.d then 'expired'
        when h.next_expiry <= t.d + 30 then 'expiring'
        when h.next_expiry <= t.d + 90 then 'upcoming'
        else 'valid'
      end as status
    from activity a
    cross join today t
    left join health h on h.client_id = a.id
    where (coalesce(btrim(search), '') = '' or position(lower(btrim(search)) in a.haystack) > 0)
      and (category_filter is null or a.has_category)
  ),
  filtered as (
    select
      s.id,
      row_number() over (
        order by
          case when sort_by = 'name' then lower(coalesce(nullif(btrim(s.company_name), ''), s.client_name)) end asc,
          case when sort_by = 'expiry' then s.next_expiry end asc nulls last,
          case when sort_by = 'newest' then s.created_at end desc,
          s.last_activity desc,
          s.id
      ) as position
    from scoped s
    where status_filter is null or s.status = status_filter
  )
  select jsonb_build_object(
    'ids', coalesce((
      select jsonb_agg(f.id order by f.position)
      from filtered f
      where f.position > greatest(page_offset, 0)
        and f.position <= greatest(page_offset, 0) + least(greatest(page_limit, 1), 100)
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'counts', coalesce((
      select jsonb_object_agg(g.status, g.n)
      from (select s.status, count(*) as n from scoped s group by s.status) g
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.directory_page(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.directory_page(text, text, text, text, integer, integer) to authenticated;
