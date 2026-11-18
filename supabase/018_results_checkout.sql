-- 018_results_checkout.sql
-- Paid checkout for the 2026 WatchTok Report ($1,299, 12 months of full access).
-- Run once in the Supabase SQL Editor, after 017. Safe to re-run.
--
-- What it adds
--   results_codes          referral codes (record who referred, no price change) and
--                          single-use discount codes ($300 off). Managed by Cris in SQL.
--   results_orders         one row per checkout attempt; written only by the server.
--   results_stripe_events  Stripe webhook event ids, so a retried event is applied once.
--   results_grant_paid_access(order)   called by the webhook after payment.
--   results_revoke_paid_access(order)  called by the webhook on refund or dispute.
--   results_add_company_reader(buyer_email, reader_email)   Cris adds a brand's extra
--                          readers by hand (same company domain, up to 3 people in total).
--   results_new_code(...), results_orders_report()          admin helpers.
--
-- Founding Members (Part A) are never touched: if a buyer already has full access with
-- no end date, a purchase records the order but leaves their access as it is, and a
-- refund never ends access that the purchase did not grant.

begin;

-- ---------------------------------------------------------------- codes
create table if not exists public.results_codes (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9-]{4,40}$'),
  kind text not null check (kind in ('referral', 'discount')),
  member_label text not null,                -- the Founding Member the code belongs to
  discount_cents integer not null default 0 check (discount_cents >= 0),
  max_uses integer,                          -- null = unlimited (referral codes)
  use_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'referral' and discount_cents = 0) or (kind = 'discount' and discount_cents > 0))
);
alter table public.results_codes enable row level security;
revoke all on public.results_codes from anon, authenticated;

-- ---------------------------------------------------------------- orders
create table if not exists public.results_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  email text not null,
  buyer_name text not null,
  brand_name text check (brand_name is null or char_length(brand_name) between 1 and 160),
  license text not null check (license in ('company', 'personal')),
  code text references public.results_codes(code),
  code_kind text,
  referrer_label text,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'refunded', 'disputed')),
  stripe_session_id text unique,
  stripe_payment_intent text unique,
  currency text,
  amount_subtotal integer,
  amount_discount integer,
  amount_tax integer,
  amount_total integer,
  access_until timestamptz,
  access_granted boolean not null default false,  -- false when the buyer already had open-ended access
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  revoked_at timestamptz
);
create index if not exists results_orders_user_idx on public.results_orders(user_id);
create index if not exists results_orders_code_idx on public.results_orders(code);
alter table public.results_orders enable row level security;
revoke all on public.results_orders from anon, authenticated;
grant select on public.results_orders to authenticated;
drop policy if exists "results orders read own" on public.results_orders;
create policy "results orders read own" on public.results_orders
  for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.results_stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.results_stripe_events enable row level security;
revoke all on public.results_stripe_events from anon, authenticated;

-- ---------------------------------------------------------------- grant after payment
create or replace function public.results_grant_paid_access(p_order uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.results_orders%rowtype;
  m public.results_members%rowtype;
  v_until timestamptz;
begin
  select * into o from public.results_orders where id = p_order for update;
  if not found then return 'no order'; end if;
  if o.status <> 'paid' or o.access_until is not null then return 'nothing to do'; end if;

  v_until := public.results_end_of_day(((coalesce(o.paid_at, now()) at time zone 'America/New_York')::date + interval '12 months')::date);
  if o.code is not null then
    update public.results_codes set use_count = use_count + 1 where code = o.code;
  end if;
  select * into m from public.results_members where user_id = o.user_id for update;

  if found and m.tier in ('full', 'admin') and m.access_until is null then
    -- Founding Member or other open-ended access: keep it exactly as it is.
    update public.results_orders set access_until = v_until, access_granted = false where id = o.id;
    return 'kept existing open-ended access';
  end if;

  update public.results_members
     set tier = 'full',
         access_until = greatest(v_until, case when m.tier = 'full' then m.access_until end),
         access_source = 'stripe:' || o.id,
         failed_passcode_attempts = 0,
         updated_at = now()
   where user_id = o.user_id;

  update public.results_orders set access_until = v_until, access_granted = true where id = o.id;
  return 'granted';
end;
$$;

-- ---------------------------------------------------------------- revoke on refund/dispute
create or replace function public.results_revoke_paid_access(p_order uuid, p_status text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.results_orders%rowtype;
begin
  if p_status not in ('refunded', 'disputed') then raise exception 'bad status'; end if;
  select * into o from public.results_orders where id = p_order for update;
  if not found then return 'no order'; end if;
  if o.revoked_at is not null then return 'already revoked'; end if;

  update public.results_orders set status = p_status, revoked_at = now() where id = o.id;

  if o.access_granted then
    -- Ends only access this order granted (buyer and any company readers).
    update public.results_members
       set access_until = now(), updated_at = now()
     where access_source in ('stripe:' || o.id, 'company:' || o.id) and tier = 'full';
  end if;
  return 'revoked';
end;
$$;

-- ---------------------------------------------------------------- extra company readers
-- Usage: select results_add_company_reader('buyer@brand.com', 'colleague@brand.com');
create or replace function public.results_add_company_reader(p_buyer_email text, p_reader_email text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.results_orders%rowtype;
  r public.results_members%rowtype;
  v_buyer_domain text := lower(split_part(btrim(p_buyer_email), '@', 2));
  v_reader_domain text := lower(split_part(btrim(p_reader_email), '@', 2));
  v_count integer;
begin
  select * into o from public.results_orders
   where lower(email) = lower(btrim(p_buyer_email)) and status = 'paid' and license = 'company'
     and access_until > now()
   order by paid_at desc limit 1;
  if not found then return 'No active company purchase for ' || p_buyer_email || '.'; end if;
  if v_buyer_domain in ('gmail.com','googlemail.com','yahoo.com','outlook.com','hotmail.com','live.com',
                        'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','msn.com','comcast.net') then
    return 'The buyer used a personal email (' || v_buyer_domain || '). Decide by hand; nothing changed.';
  end if;
  if v_reader_domain <> v_buyer_domain then
    return 'Domain mismatch: reader must use @' || v_buyer_domain || '. Nothing changed.';
  end if;
  select * into r from public.results_members where lower(email) = lower(btrim(p_reader_email));
  if not found then return p_reader_email || ' must register on the results site first.'; end if;
  if r.user_id = o.user_id then return 'That is the buyer.'; end if;
  if r.tier = 'full' and r.access_until is null then return p_reader_email || ' already has open-ended access.'; end if;

  select count(*) into v_count from public.results_members where access_source = 'company:' || o.id;
  if v_count >= 2 then return 'Limit reached: this license already has 3 readers (buyer + 2).'; end if;

  update public.results_members
     set tier = 'full', access_until = o.access_until, access_source = 'company:' || o.id, updated_at = now()
   where user_id = r.user_id;
  return p_reader_email || ' added to ' || coalesce(o.brand_name, o.email) || '''s license through '
         || to_char(o.access_until at time zone 'America/New_York', 'Mon FMDD, YYYY') || '.';
end;
$$;

-- ---------------------------------------------------------------- admin helpers
-- select results_new_code('JON-REF', 'referral', 'Jon');
-- select results_new_code('JON-300', 'discount', 'Jon', 30000, 1);
create or replace function public.results_new_code(p_code text, p_kind text, p_member text,
                                                   p_discount_cents integer default 0, p_max_uses integer default null)
returns text
language sql security definer
set search_path = ''
as $$
  insert into public.results_codes (code, kind, member_label, discount_cents, max_uses)
  values (upper(btrim(p_code)), p_kind, p_member, p_discount_cents,
          case when p_kind = 'discount' then coalesce(p_max_uses, 1) else p_max_uses end)
  returning 'Code ' || code || ' (' || kind || ') created for ' || member_label;
$$;

create or replace function public.results_orders_report()
returns table (paid_at text, buyer text, email text, brand text, code text, referrer text,
               collected_usd numeric, tax_usd numeric, status text, access_until text)
language sql security definer stable
set search_path = ''
as $$
  select to_char(o.paid_at at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI'),
         o.buyer_name, o.email, o.brand_name, o.code, o.referrer_label,
         round((coalesce(o.amount_total,0) - coalesce(o.amount_tax,0)) / 100.0, 2),
         round(coalesce(o.amount_tax,0) / 100.0, 2),
         o.status, to_char(o.access_until at time zone 'America/New_York', 'YYYY-MM-DD')
    from public.results_orders o
   where o.status <> 'pending' and o.status <> 'expired'
   order by o.paid_at desc nulls last;
$$;

revoke all on function public.results_grant_paid_access(uuid) from public, anon, authenticated;
revoke all on function public.results_revoke_paid_access(uuid, text) from public, anon, authenticated;
revoke all on function public.results_add_company_reader(text, text) from public, anon, authenticated;
revoke all on function public.results_new_code(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.results_orders_report() from public, anon, authenticated;
grant execute on function public.results_grant_paid_access(uuid) to service_role;
grant execute on function public.results_revoke_paid_access(uuid, text) to service_role;

-- ---------------------------------------------------------------- welcome email + sale alert
create or replace function public.results_order_paid_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_key text;
  v_until text;
  v_esc_name text;
begin
  if not (new.status = 'paid' and new.access_until is not null and old.access_until is null) then
    return new;
  end if;
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    if v_key is null then raise warning 'order email: no resend_api_key'; return new; end if;
    v_until := to_char(new.access_until at time zone 'America/New_York', 'FMMonth FMDD, YYYY');
    v_esc_name := replace(replace(new.buyer_name, '<', '&lt;'), '>', '&gt;');

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'WatchTok Survey <results@watchtoksurvey.com>',
        'to', jsonb_build_array(new.email),
        'reply_to', 'watchtoksurvey@gmail.com',
        'subject', 'Your WatchTok Report access is ready',
        'html',
          '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;max-width:560px">'
          || '<p>Hi ' || v_esc_name || ',</p>'
          || '<p>Thank you for buying the <b>2026 WatchTok Report</b>. Your full access is active now and runs through <b>' || v_until || '</b>.</p>'
          || '<p><b>How to read it:</b> go to <a href="https://watchtoksurvey.com/results/">watchtoksurvey.com/results</a> and sign in with <b>' || replace(replace(new.email, '<', '&lt;'), '>', '&gt;') || '</b>. '
          || 'Forgot your password? Use "Forgot password" on the sign-in page.</p>'
          || '<p>Your receipt comes separately from Stripe, our payment provider.</p>'
          || '<p><b>A free 30-minute walkthrough:</b> if it would help to talk through the findings for your brand, '
          || '<a href="https://calendar.app.google/bgZMVqnmMMFhTGcu5">book a time here</a> (Google Meet).</p>'
          || '<p>Questions? Just reply to this email.</p>'
          || '<p>Cris Bjelajac<br>WatchTok Survey</p></div>'
      )
    );
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'WatchTok Survey Results <results@watchtoksurvey.com>',
        'to', jsonb_build_array('watchtoksurvey@gmail.com'),
        'reply_to', new.email,
        'subject', 'New sale: ' || coalesce(new.brand_name, new.buyer_name)
                   || case when new.code is not null then ' (code ' || new.code || ')' else '' end,
        'html', '<p>' || v_esc_name || ' &lt;' || replace(replace(new.email, '<', '&lt;'), '>', '&gt;') || '&gt; bought the report. '
                || 'Access through ' || v_until || '. Collected (before tax): '
                || to_char((coalesce(new.amount_total,0) - coalesce(new.amount_tax,0)) / 100.0, 'FM999,990.00')
                || ' ' || upper(coalesce(new.currency, 'usd')) || '.</p>'
      )
    );
  exception when others then
    raise warning 'results_order_paid_email failed: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.results_order_paid_email() from public, anon, authenticated;

drop trigger if exists results_order_paid_email on public.results_orders;
create trigger results_order_paid_email
  after update on public.results_orders
  for each row execute function public.results_order_paid_email();

commit;
