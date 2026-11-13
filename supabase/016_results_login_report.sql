-- WatchTok Survey RESULTS — login / visit tracker
-- Run once in the Supabase SQL Editor (already applied Nov 13, 2026). Safe to re-run.
--
-- Usage (SQL Editor):
--   select * from public.results_login_report();      -- everyone, all time
--   select * from public.results_login_report(7);     -- only people active in the last 7 days
--
-- Columns: name, email, organization, access, registered, last_visit (ET),
-- visits (results page opens), days_active, full_report_views, last_full_view, sign_ins.
-- "visits" counts each time the results page loads (preview or full); "sign_ins"
-- counts password sign-ins only (returning visitors with a saved session don't sign in again).
-- Events are written by the browser, so treat counts as a guide, not proof (security review L3).

create or replace function public.results_login_report(p_days integer default null)
returns table(
  name text, email text, organization text, access text,
  registered date, last_visit text, visits bigint, days_active bigint,
  full_report_views bigint, last_full_view text, sign_ins bigint
)
language sql stable security definer
set search_path = ''
as $$
  with ev as (
    select e.user_id, e.event, e.created_at at time zone 'America/New_York' as et
    from public.results_events e
    where p_days is null or e.created_at >= now() - make_interval(days => p_days)
  ),
  agg as (
    select user_id,
           max(et) filter (where event in ('login','view_sample','view_full')) as last_visit,
           count(*) filter (where event in ('view_sample','view_full')) as visits,
           count(distinct et::date) filter (where event in ('login','view_sample','view_full')) as days_active,
           count(*) filter (where event = 'view_full') as full_views,
           max(et) filter (where event = 'view_full') as last_full,
           count(*) filter (where event = 'login') as sign_ins
    from ev group by user_id
  )
  select m.full_name, m.email, m.organization,
         case public.results_effective_tier(m.tier, m.access_until)
              when 'admin' then 'Admin' when 'full' then 'Full'
              else case when m.tier = 'full' then 'Preview (full access ended)' else 'Preview' end end,
         (m.created_at at time zone 'America/New_York')::date,
         coalesce(to_char(a.last_visit, 'Mon DD, YYYY HH12:MI AM') || ' ET', 'Never'),
         coalesce(a.visits, 0), coalesce(a.days_active, 0), coalesce(a.full_views, 0),
         coalesce(to_char(a.last_full, 'Mon DD, YYYY HH12:MI AM') || ' ET', '—'),
         coalesce(a.sign_ins, 0)
  from public.results_members m
  left join agg a on a.user_id = m.user_id
  where p_days is null or a.user_id is not null
  order by a.last_visit desc nulls last, m.created_at
$$;

revoke all on function public.results_login_report(integer) from public, anon, authenticated;

select 'WatchTok results login report installed' as result;
