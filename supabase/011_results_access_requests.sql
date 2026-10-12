-- WatchTok Survey RESULTS — "Request full access" (lead capture before paid access)
-- Run once in the Supabase SQL Editor, after 010_results_access.sql. Safe to re-run.
--
-- Adds one table and one function. It does not change any existing table,
-- survey data, member, passcode or storage rule.
--
--   results_access_requests   one row per registered viewer who tapped
--                             "Request full access" (uses their account email)
--   results_request_access()  the button's action; records or refreshes the request

begin;

create table if not exists public.results_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text check (source is null or source ~ '^[a-z0-9-]{1,32}$'),
  results_version text check (results_version is null or char_length(results_version) <= 40),
  request_count integer not null default 1,
  status text not null default 'new' check (status in ('new', 'contacted', 'granted', 'declined')),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now()
);

alter table public.results_access_requests enable row level security;

-- Record (or refresh) a request for the signed-in member. Email and name come
-- from their existing results account, so the button needs no form.
create or replace function public.results_request_access(
  p_source text default null,
  p_results_version text default null
)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.results_members%rowtype;
  v_source text := lower(nullif(btrim(coalesce(p_source, '')), ''));
  v_row public.results_access_requests%rowtype;
begin
  if not public.results_is_real_user() then
    raise exception 'Please sign in with an email account.' using errcode = '42501';
  end if;

  select * into v_member from public.results_members where user_id = v_uid;
  if not found then
    raise exception 'Please finish registration first.' using errcode = 'P0002';
  end if;

  if v_member.tier in ('full', 'admin') then
    return json_build_object('ok', true, 'already_full', true, 'email', v_member.email);
  end if;

  if v_source is not null and v_source !~ '^[a-z0-9-]{1,32}$' then
    v_source := null;
  end if;

  insert into public.results_access_requests (user_id, source, results_version)
  values (v_uid, v_source, left(p_results_version, 40))
  on conflict (user_id) do update
    set request_count = public.results_access_requests.request_count + 1,
        last_requested_at = now(),
        source = coalesce(public.results_access_requests.source, excluded.source),
        results_version = excluded.results_version
  returning * into v_row;

  return json_build_object(
    'ok', true,
    'email', v_member.email,
    'first_requested_at', v_row.first_requested_at,
    'repeat', v_row.request_count > 1
  );
end;
$$;

-- ---------------------------------------------------------------- privileges

revoke all on table public.results_access_requests from anon, authenticated;
grant select on table public.results_access_requests to authenticated;

revoke all on function public.results_request_access(text, text) from public, anon;
grant execute on function public.results_request_access(text, text) to authenticated;

-- A viewer can see only their own request (so the page can show "Request received");
-- admins can see all of them.
drop policy if exists "results access requests read own or admin" on public.results_access_requests;
create policy "results access requests read own or admin" on public.results_access_requests
  for select to authenticated
  using (
    public.results_is_real_user()
    and (user_id = auth.uid() or public.results_current_tier() = 'admin')
  );

commit;

select 'WatchTok "Request full access" installed' as result;
