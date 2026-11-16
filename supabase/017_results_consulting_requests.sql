-- WatchTok Survey RESULTS — "Talk to Our Analysts" (consulting quote requests)
-- Run once in the Supabase SQL Editor, AFTER 012 (email alert) and 013 (access end dates).
-- Safe to re-run. Does not change any existing table, member, passcode or storage rule.
--
--   results_consulting_requests    one row per full-access reader who tapped
--                                  "Talk to Our Analysts" in the Next Steps section
--   results_request_consulting()   the button's action; records or refreshes the request
--   email alert                    emails watchtoksurvey@gmail.com (Reply-To = the reader)
--                                  on the first request, and again on a repeat request
--                                  only if the last one was more than a day ago
--
-- Only readers with full access can use it (preview readers never see the button).
--
-- Review the list (SQL Editor):
--   select m.full_name, m.email, m.organization, r.request_count, r.status,
--          r.first_requested_at at time zone 'America/New_York' as first_et,
--          r.last_requested_at  at time zone 'America/New_York' as last_et
--   from public.results_consulting_requests r
--   join public.results_members m using (user_id)
--   order by r.last_requested_at desc;
--
-- Mark one handled:
--   update public.results_consulting_requests set status = 'contacted'
--   where user_id = (select user_id from public.results_members where email = 'name@brand.com');

begin;

create extension if not exists pg_net with schema extensions;

create table if not exists public.results_consulting_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  results_version text check (results_version is null or char_length(results_version) <= 40),
  request_count integer not null default 1,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'closed')),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now()
);

alter table public.results_consulting_requests enable row level security;

create or replace function public.results_request_consulting(p_results_version text default null)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.results_members%rowtype;
  v_row public.results_consulting_requests%rowtype;
begin
  if not public.results_is_real_user() then
    raise exception 'Please sign in with an email account.' using errcode = '42501';
  end if;

  select * into v_member from public.results_members where user_id = v_uid;
  if not found then
    raise exception 'Please finish registration first.' using errcode = 'P0002';
  end if;

  if public.results_effective_tier(v_member.tier, v_member.access_until) not in ('full', 'admin') then
    raise exception 'This is available to full-access readers.' using errcode = '42501';
  end if;

  insert into public.results_consulting_requests (user_id, results_version)
  values (v_uid, left(p_results_version, 40))
  on conflict (user_id) do update
    set request_count = public.results_consulting_requests.request_count + 1,
        last_requested_at = now(),
        results_version = excluded.results_version
  returning * into v_row;

  return json_build_object(
    'ok', true,
    'email', v_member.email,
    'repeat', v_row.request_count > 1
  );
end;
$$;

create or replace function public.results_notify_consulting_request()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_key text;
  v_member public.results_members%rowtype;
  v_type text;
  v_html text;
begin
  -- Repeat taps: email again only if the previous request was over a day ago.
  if tg_op = 'UPDATE' and old.last_requested_at > now() - interval '1 day' then
    return new;
  end if;

  begin
    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'resend_api_key'
    limit 1;

    if v_key is null then
      raise warning 'results_notify_consulting_request: no resend_api_key in Vault; email skipped';
      return new;
    end if;

    select * into v_member from public.results_members where user_id = new.user_id;

    v_type := case v_member.member_type
      when 'brand' then 'Watch brand'
      when 'creator' then 'WatchTok creator'
      when 'team' then 'Founding WatchTok team'
      else 'Other' end;

    v_html :=
      '<p><strong>' || case when new.request_count > 1 then 'Repeat consulting request' else 'New consulting request' end
      || '</strong> ("Talk to Our Analysts") on watchtoksurvey.com/results</p>'
      || '<table cellpadding="4" style="font-family:Arial,sans-serif;font-size:14px">'
      || '<tr><td><b>Name</b></td><td>' || coalesce(replace(replace(v_member.full_name, '<', '&lt;'), '>', '&gt;'), '') || '</td></tr>'
      || '<tr><td><b>Email</b></td><td>' || coalesce(replace(replace(v_member.email, '<', '&lt;'), '>', '&gt;'), '') || '</td></tr>'
      || '<tr><td><b>Organization</b></td><td>' || coalesce(replace(replace(v_member.organization, '<', '&lt;'), '>', '&gt;'), '—') || '</td></tr>'
      || '<tr><td><b>I am a</b></td><td>' || v_type || '</td></tr>'
      || '<tr><td><b>Times requested</b></td><td>' || new.request_count || '</td></tr>'
      || '<tr><td><b>Report version</b></td><td>' || coalesce(new.results_version, '—') || '</td></tr>'
      || '<tr><td><b>Requested</b></td><td>' || to_char(new.last_requested_at at time zone 'America/New_York', 'Mon DD, YYYY HH12:MI AM') || ' ET</td></tr>'
      || '</table>'
      || '<p>Reply to this email to answer them directly.</p>';

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'WatchTok Survey Results <results@watchtoksurvey.com>',
        'to', jsonb_build_array('watchtoksurvey@gmail.com'),
        'reply_to', v_member.email,
        'subject', 'Consulting request: ' || coalesce(nullif(v_member.organization, ''), v_member.full_name, v_member.email),
        'html', v_html
      )
    );
  exception when others then
    -- Never block saving the request because of an email problem.
    raise warning 'results_notify_consulting_request failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------- privileges

revoke all on table public.results_consulting_requests from anon, authenticated;
grant select on table public.results_consulting_requests to authenticated;

revoke all on function public.results_request_consulting(text) from public, anon;
grant execute on function public.results_request_consulting(text) to authenticated;

revoke all on function public.results_notify_consulting_request() from public, anon, authenticated;

drop policy if exists "results consulting requests read own or admin" on public.results_consulting_requests;
create policy "results consulting requests read own or admin" on public.results_consulting_requests
  for select to authenticated
  using (
    public.results_is_real_user()
    and (user_id = auth.uid() or public.results_current_tier() = 'admin')
  );

drop trigger if exists results_consulting_request_email on public.results_consulting_requests;
create trigger results_consulting_request_email
  after insert or update of request_count on public.results_consulting_requests
  for each row execute function public.results_notify_consulting_request();

commit;

select 'WatchTok "Talk to Our Analysts" requests installed' as result;
