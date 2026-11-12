-- WatchTok Survey RESULTS — access end dates and passcode admin tools
-- Run once in the Supabase SQL Editor, after 010, 011 and 012. Safe to re-run.
--
-- Nothing changes for anyone today:
--   * every existing member keeps the access they have, with NO end date
--   * every existing passcode (including "Founding team") stays active
--
-- What it adds:
--   results_members.access_until     optional end date for full access. When it
--                                    passes, the person drops back to the free preview
--                                    (the report files stop opening for them).
--                                    Empty = no end date. Admins never expire.
--   results_passcodes.access_until   optional: everyone who uses this code gets full
--   results_passcodes.access_days    access until that date, or for that many days.
--
-- Admin tools (run in the SQL Editor; the website cannot call them):
--   results_new_passcode(label, code, access_until, access_days, use_by, max_uses)
--   results_set_access_until(email, date)   give/renew/shorten full access (null = no end date)
--   results_end_access(email)               end full access right now
--   results_retire_passcode(label)          stop a code working (people who used it keep access)
--   results_restore_passcode(label)         undo a retirement
--   results_set_passcode_use_by(label, date) change the last day a code can be used (null = no limit)
--   results_access_report()                 who has what, when it ends, which code they used
--
-- Dates are whole days, US Eastern: '2026-12-31' means through the end of Dec 31.

begin;

alter table public.results_members add column if not exists access_until timestamptz;
alter table public.results_passcodes add column if not exists access_until timestamptz;
alter table public.results_passcodes add column if not exists access_days integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'results_passcodes_access_days_check') then
    alter table public.results_passcodes
      add constraint results_passcodes_access_days_check check (access_days is null or access_days > 0);
  end if;
end $$;

-- ---------------------------------------------------------------- helpers

-- End of a calendar day in US Eastern time ('2026-12-31' -> Jan 1 00:00 ET).
create or replace function public.results_end_of_day(p_day date)
returns timestamptz
language sql immutable
set search_path = ''
as $$
  select case when p_day is null then null
              else ((p_day + 1)::timestamp at time zone 'America/New_York') end
$$;

create or replace function public.results_day_label(p_at timestamptz)
returns text
language sql stable
set search_path = ''
as $$
  -- The last full day of access, e.g. 'Dec 31, 2026'.
  select to_char((p_at at time zone 'America/New_York') - interval '1 second', 'Mon FMDD, YYYY')
$$;

-- What a member can actually see right now.
create or replace function public.results_effective_tier(p_tier text, p_until timestamptz)
returns text
language sql stable
set search_path = ''
as $$
  select case when p_tier = 'full' and p_until is not null and p_until <= now() then 'sample'
              else p_tier end
$$;

-- Used by every storage and table rule: an ended access reads as 'sample'.
create or replace function public.results_current_tier()
returns text
language sql stable security definer
set search_path = ''
as $$
  select public.results_effective_tier(m.tier, m.access_until)
  from public.results_members m
  where m.user_id = auth.uid()
    and public.results_is_real_user()
$$;

-- ---------------------------------------------------------------- website actions

create or replace function public.results_redeem_passcode(p_code text)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.results_members%rowtype;
  v_pc public.results_passcodes%rowtype;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_tier text;
  v_until timestamptz;
begin
  if not public.results_is_real_user() then
    raise exception 'Please sign in with an email account.' using errcode = '42501';
  end if;

  select * into v_member from public.results_members where user_id = v_uid for update;
  if not found then
    raise exception 'Please finish registration first.' using errcode = 'P0002';
  end if;

  v_tier := public.results_effective_tier(v_member.tier, v_member.access_until);
  if v_tier in ('full', 'admin') then
    return json_build_object('ok', true, 'tier', v_tier, 'message', 'You already have full access.');
  end if;

  if v_member.failed_passcode_attempts >= 10 then
    return json_build_object('ok', false, 'tier', v_tier,
      'message', 'Too many incorrect passcodes. Email watchtoksurvey@gmail.com to unlock your account.');
  end if;

  if v_code = '' then
    return json_build_object('ok', false, 'tier', v_tier, 'message', 'Enter a passcode.');
  end if;

  select * into v_pc
  from public.results_passcodes p
  where p.active
    and (p.expires_at is null or p.expires_at > now())
    and (p.max_uses is null or p.use_count < p.max_uses)
    and p.code_hash = extensions.crypt(v_code, p.code_hash)
  limit 1
  for update;

  if not found then
    update public.results_members
       set failed_passcode_attempts = failed_passcode_attempts + 1, updated_at = now()
     where user_id = v_uid;
    return json_build_object('ok', false, 'tier', v_tier, 'message', 'That passcode is not valid.');
  end if;

  v_until := coalesce(
    v_pc.access_until,
    case when v_pc.access_days is not null
         then public.results_end_of_day((now() at time zone 'America/New_York')::date + v_pc.access_days) end
  );

  -- A code whose end date has already passed would unlock nothing.
  if v_until is not null and v_until <= now() then
    return json_build_object('ok', false, 'tier', v_tier, 'message', 'That passcode has ended. Email watchtoksurvey@gmail.com for a new one.');
  end if;

  update public.results_passcodes set use_count = use_count + 1 where id = v_pc.id;
  update public.results_members
     set tier = v_pc.grants_tier,
         access_until = v_until,
         access_source = 'passcode:' || v_pc.label,
         failed_passcode_attempts = 0,
         updated_at = now()
   where user_id = v_uid;
  insert into public.results_events (user_id, event, detail) values (v_uid, 'passcode_redeemed', v_pc.label);

  return json_build_object('ok', true, 'tier', v_pc.grants_tier, 'access_until', v_until,
    'message', case when v_until is null then 'Full access unlocked.'
                    else 'Full access unlocked through ' || public.results_day_label(v_until) || '.' end);
end;
$$;

create or replace function public.results_register(
  p_full_name text,
  p_organization text,
  p_member_type text,
  p_passcode text default null
)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_new boolean;
  v_redeem json;
  v_tier text;
begin
  if not public.results_is_real_user() then
    raise exception 'Please sign in with an email account.' using errcode = '42501';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  v_new := not exists (select 1 from public.results_members where user_id = v_uid);

  insert into public.results_members (user_id, email, full_name, organization, member_type)
  values (v_uid, v_email, btrim(p_full_name), nullif(btrim(p_organization), ''), p_member_type)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        organization = excluded.organization,
        member_type = excluded.member_type,
        email = excluded.email,
        updated_at = now();

  if v_new then
    insert into public.results_events (user_id, event) values (v_uid, 'registered');
  end if;

  if nullif(btrim(coalesce(p_passcode, '')), '') is not null then
    v_redeem := public.results_redeem_passcode(p_passcode);
  end if;

  select public.results_effective_tier(tier, access_until) into v_tier
  from public.results_members where user_id = v_uid;
  return json_build_object('ok', true, 'tier', v_tier, 'passcode', v_redeem);
end;
$$;

-- Same as 011, except someone whose access has ended can ask again.
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

  if public.results_effective_tier(v_member.tier, v_member.access_until) in ('full', 'admin') then
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

-- ---------------------------------------------------------------- admin tools (SQL Editor only)

-- Setting someone to full or admin by hand gives open-ended access (as before).
create or replace function public.results_set_tier(p_email text, p_tier text)
returns text
language sql security definer
set search_path = ''
as $$
  update public.results_members
     set tier = p_tier,
         access_until = case when p_tier = 'sample' then access_until else null end,
         access_source = 'admin', failed_passcode_attempts = 0, updated_at = now()
   where lower(email) = lower(btrim(p_email))
  returning email || ' is now ' || tier
$$;

-- Named arguments, e.g.
--   select results_new_passcode('Dave - La Touraine', 'LATOUR-7Q4K-X9', access_until => '2026-12-31');
--   select results_new_passcode('Mike - DeMarco', 'DEMARCO-22PL-M4', access_days => 30, use_by => '2026-11-30');
-- max_uses defaults to 1 (one person). Use max_uses => null for unlimited.
drop function if exists public.results_new_passcode(text, text, date, integer, date, integer);
create or replace function public.results_new_passcode(
  label text,
  code text,
  access_until date default null,
  access_days integer default null,
  use_by date default null,
  max_uses integer default 1
)
returns text
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_label text := btrim(results_new_passcode.label);
begin
  if access_until is not null and access_days is not null then
    raise exception 'Give an access end date or a number of days, not both.';
  end if;
  if exists (select 1 from public.results_passcodes p where lower(p.label) = lower(v_label)) then
    raise exception 'A passcode named "%" already exists. Pick another name.', v_label;
  end if;
  if char_length(btrim(coalesce(code, ''))) < 8 then
    raise exception 'Use a passcode of at least 8 characters.';
  end if;

  insert into public.results_passcodes (label, code_hash, max_uses, expires_at, access_until, access_days)
  values (v_label, extensions.crypt(upper(btrim(code)), extensions.gen_salt('bf')),
          max_uses, public.results_end_of_day(use_by), public.results_end_of_day(access_until), access_days);

  return 'Passcode "' || v_label || '" created'
    || case when max_uses is null then ' (unlimited uses)' else ' (' || max_uses || ' use' || case when max_uses = 1 then '' else 's' end || ')' end
    || case when access_until is not null then '; access through ' || to_char(access_until, 'Mon FMDD, YYYY')
            when access_days is not null then '; access for ' || access_days || ' days after it is used'
            else '; access has no end date' end
    || case when use_by is not null then '; must be used by ' || to_char(use_by, 'Mon FMDD, YYYY') else '' end
    || '.';
end;
$$;

-- Give, renew or shorten someone's full access. Null = full access with no end date.
create or replace function public.results_set_access_until(p_email text, p_until date)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.results_members%rowtype;
begin
  select * into v_row from public.results_members where lower(email) = lower(btrim(p_email));
  if not found then
    return 'No results account for ' || p_email || '. They need to register first.';
  end if;
  if v_row.tier = 'admin' then
    return v_row.email || ' is an admin; admin access does not end.';
  end if;

  update public.results_members
     set tier = 'full',
         access_until = public.results_end_of_day(p_until),
         access_source = case when tier = 'full' then access_source else 'admin' end,
         failed_passcode_attempts = 0,
         updated_at = now()
   where user_id = v_row.user_id;

  return v_row.email || ' has full access '
    || case when p_until is null then 'with no end date.'
            else 'through ' || to_char(p_until, 'Mon FMDD, YYYY') || '.' end;
end;
$$;

-- End someone's full access immediately (they keep their free preview account).
create or replace function public.results_end_access(p_email text)
returns text
language sql security definer
set search_path = ''
as $$
  update public.results_members
     set access_until = now(), updated_at = now()
   where lower(email) = lower(btrim(p_email)) and tier = 'full'
  returning email || '''s full access has ended; they now see the free preview.'
$$;

create or replace function public.results_retire_passcode(p_label text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_label text;
  v_people integer;
begin
  update public.results_passcodes set active = false
   where lower(label) = lower(btrim(p_label))
  returning label into v_label;
  if v_label is null then
    return 'No passcode named "' || p_label || '".';
  end if;
  select count(*) into v_people from public.results_members where access_source = 'passcode:' || v_label;
  return 'Passcode "' || v_label || '" retired: it no longer unlocks anything. '
    || v_people || case when v_people = 1 then ' person' else ' people' end || ' who already used it keep their access.';
end;
$$;

create or replace function public.results_restore_passcode(p_label text)
returns text
language sql security definer
set search_path = ''
as $$
  update public.results_passcodes set active = true
   where lower(label) = lower(btrim(p_label))
  returning 'Passcode "' || label || '" works again.'
$$;

create or replace function public.results_set_passcode_use_by(p_label text, p_use_by date)
returns text
language sql security definer
set search_path = ''
as $$
  update public.results_passcodes set expires_at = public.results_end_of_day(p_use_by)
   where lower(label) = lower(btrim(p_label))
  returning 'Passcode "' || label || '" '
    || case when p_use_by is null then 'can be used any time.'
            else 'can be used through ' || to_char(p_use_by, 'Mon FMDD, YYYY') || '.' end
$$;

create or replace function public.results_access_report()
returns table (
  email text,
  name text,
  organization text,
  access text,
  access_ends text,
  unlocked_by text,
  registered date
)
language sql stable security definer
set search_path = ''
as $$
  select m.email,
         m.full_name,
         m.organization,
         case public.results_effective_tier(m.tier, m.access_until)
              when 'admin' then 'Admin'
              when 'full' then 'Full'
              else case when m.tier = 'full' then 'Preview (full access ended)' else 'Preview' end end,
         case when m.tier = 'full' and m.access_until is not null then public.results_day_label(m.access_until)
              when m.tier in ('full', 'admin') then 'No end date' end,
         m.access_source,
         (m.created_at at time zone 'America/New_York')::date
  from public.results_members m
  order by (m.tier = 'admin') desc,
           (public.results_effective_tier(m.tier, m.access_until) = 'full') desc,
           m.access_until nulls last,
           m.created_at
$$;

-- ---------------------------------------------------------------- privileges

revoke all on function public.results_end_of_day(date) from public, anon;
revoke all on function public.results_day_label(timestamptz) from public, anon;
revoke all on function public.results_effective_tier(text, timestamptz) from public, anon;
grant execute on function public.results_end_of_day(date) to authenticated;
grant execute on function public.results_day_label(timestamptz) to authenticated;
grant execute on function public.results_effective_tier(text, timestamptz) to authenticated;

revoke all on function public.results_set_tier(text, text) from public, anon, authenticated;
revoke all on function public.results_new_passcode(text, text, date, integer, date, integer) from public, anon, authenticated;
revoke all on function public.results_set_access_until(text, date) from public, anon, authenticated;
revoke all on function public.results_end_access(text) from public, anon, authenticated;
revoke all on function public.results_retire_passcode(text) from public, anon, authenticated;
revoke all on function public.results_restore_passcode(text) from public, anon, authenticated;
revoke all on function public.results_set_passcode_use_by(text, date) from public, anon, authenticated;
revoke all on function public.results_access_report() from public, anon, authenticated;

grant execute on function public.results_redeem_passcode(text) to authenticated;
grant execute on function public.results_register(text, text, text, text) to authenticated;
grant execute on function public.results_request_access(text, text) to authenticated;
grant execute on function public.results_current_tier() to authenticated;

commit;

select 'WatchTok results access end dates installed. Nobody''s access changed.' as result;
