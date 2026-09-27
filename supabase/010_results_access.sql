-- WatchTok Survey RESULTS — access control (registration, tiers, passcodes)
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- What this creates:
--   * results_members   one row per registered results viewer (email accounts only)
--   * results_passcodes hashed collaborator passcodes (never readable from the browser)
--   * results_events    simple usage log (logins, views, passcode redemptions)
--   * results-content   PRIVATE storage bucket: sample/ for any registered viewer,
--                       full/ for full-access viewers only
--
-- Separation from the survey:
--   Survey respondents use anonymous Supabase sessions. Every results rule below
--   requires a non-anonymous (email) account AND a results_members row, so an
--   anonymous survey session can never read results content.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table if not exists public.results_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  organization text check (organization is null or char_length(organization) <= 160),
  member_type text not null check (member_type in ('brand', 'creator', 'team', 'other')),
  tier text not null default 'sample' check (tier in ('sample', 'full', 'admin')),
  access_source text not null default 'signup',
  failed_passcode_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.results_passcodes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  code_hash text not null,
  grants_tier text not null default 'full' check (grants_tier in ('full')),
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.results_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event text not null check (event in ('login', 'view_sample', 'view_full', 'passcode_redeemed', 'registered')),
  detail text check (detail is null or char_length(detail) <= 200),
  created_at timestamptz not null default now()
);

alter table public.results_members enable row level security;
alter table public.results_passcodes enable row level security;
alter table public.results_events enable row level security;

-- ---------------------------------------------------------------- helpers

create or replace function public.results_is_real_user()
returns boolean
language sql stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

create or replace function public.results_current_tier()
returns text
language sql stable security definer
set search_path = ''
as $$
  select m.tier
  from public.results_members m
  where m.user_id = auth.uid()
    and public.results_is_real_user()
$$;

-- Redeem a collaborator passcode for the signed-in member.
-- Wrong codes are counted; after 10 misses the account must be unlocked by an admin.
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
begin
  if not public.results_is_real_user() then
    raise exception 'Please sign in with an email account.' using errcode = '42501';
  end if;

  select * into v_member from public.results_members where user_id = v_uid for update;
  if not found then
    raise exception 'Please finish registration first.' using errcode = 'P0002';
  end if;

  if v_member.tier in ('full', 'admin') then
    return json_build_object('ok', true, 'tier', v_member.tier, 'message', 'You already have full access.');
  end if;

  if v_member.failed_passcode_attempts >= 10 then
    return json_build_object('ok', false, 'tier', v_member.tier,
      'message', 'Too many incorrect passcodes. Email watchtoksurvey@gmail.com to unlock your account.');
  end if;

  if v_code = '' then
    return json_build_object('ok', false, 'tier', v_member.tier, 'message', 'Enter a passcode.');
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
    return json_build_object('ok', false, 'tier', v_member.tier, 'message', 'That passcode is not valid.');
  end if;

  update public.results_passcodes set use_count = use_count + 1 where id = v_pc.id;
  update public.results_members
     set tier = v_pc.grants_tier,
         access_source = 'passcode:' || v_pc.label,
         failed_passcode_attempts = 0,
         updated_at = now()
   where user_id = v_uid;
  insert into public.results_events (user_id, event, detail) values (v_uid, 'passcode_redeemed', v_pc.label);

  return json_build_object('ok', true, 'tier', v_pc.grants_tier, 'message', 'Full access unlocked.');
end;
$$;

-- Create or update the signed-in person's results profile; optionally redeem a passcode.
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

  select tier into v_tier from public.results_members where user_id = v_uid;
  return json_build_object('ok', true, 'tier', v_tier, 'passcode', v_redeem);
end;
$$;

-- ---------------------------------------------------------------- admin helpers
-- These run only from the Supabase SQL Editor (they are not callable from the website).

create or replace function public.results_create_passcode(
  p_label text,
  p_code text,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns text
language sql security definer
set search_path = ''
as $$
  insert into public.results_passcodes (label, code_hash, max_uses, expires_at)
  values (p_label, extensions.crypt(upper(btrim(p_code)), extensions.gen_salt('bf')), p_max_uses, p_expires_at)
  returning 'Passcode "' || label || '" created.'
$$;

create or replace function public.results_set_tier(p_email text, p_tier text)
returns text
language sql security definer
set search_path = ''
as $$
  update public.results_members
     set tier = p_tier, access_source = 'admin', failed_passcode_attempts = 0, updated_at = now()
   where lower(email) = lower(btrim(p_email))
  returning email || ' is now ' || tier
$$;

-- ---------------------------------------------------------------- privileges

revoke all on table public.results_members, public.results_passcodes, public.results_events from anon, authenticated;
grant select on table public.results_members to authenticated;
grant select, insert on table public.results_events to authenticated;

revoke all on function public.results_redeem_passcode(text) from public, anon;
revoke all on function public.results_register(text, text, text, text) from public, anon;
revoke all on function public.results_create_passcode(text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.results_set_tier(text, text) from public, anon, authenticated;
grant execute on function public.results_redeem_passcode(text) to authenticated;
grant execute on function public.results_register(text, text, text, text) to authenticated;
grant execute on function public.results_current_tier() to authenticated;
grant execute on function public.results_is_real_user() to authenticated;

-- ---------------------------------------------------------------- row-level security

drop policy if exists "results members read own or admin" on public.results_members;
create policy "results members read own or admin" on public.results_members
  for select to authenticated
  using (
    public.results_is_real_user()
    and (user_id = auth.uid() or public.results_current_tier() = 'admin')
  );

drop policy if exists "results events insert own" on public.results_events;
create policy "results events insert own" on public.results_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.results_current_tier() is not null
    and event in ('login', 'view_sample', 'view_full')
  );

drop policy if exists "results events admin read" on public.results_events;
create policy "results events admin read" on public.results_events
  for select to authenticated
  using (public.results_current_tier() = 'admin');

-- results_passcodes intentionally has no policies: nobody reads it from the browser.

-- ---------------------------------------------------------------- private content bucket

insert into storage.buckets (id, name, public)
values ('results-content', 'results-content', false)
on conflict (id) do update set public = false;

drop policy if exists "results content sample read" on storage.objects;
create policy "results content sample read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'results-content'
    and (storage.foldername(name))[1] = 'sample'
    and public.results_current_tier() in ('sample', 'full', 'admin')
  );

drop policy if exists "results content full read" on storage.objects;
create policy "results content full read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'results-content'
    and (storage.foldername(name))[1] = 'full'
    and public.results_current_tier() in ('full', 'admin')
  );

commit;

select 'WatchTok results access control installed' as result;
