-- 026: launch fixes from the Nov 23 independent review.
-- 1. Refunding one of two paid orders no longer ends access the other order still pays for.
-- 2. Open-ended access (results_set_access_until(email, null)) is never ended by a refund.
-- 3. Welcome email: company-license wording matches how colleagues are really added.

-- 1 + 2: revoke ------------------------------------------------------------------
create or replace function public.results_revoke_paid_access(p_order uuid, p_status text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  o public.results_orders%rowtype;
  other public.results_orders%rowtype;
begin
  if p_status not in ('refunded', 'disputed') then raise exception 'bad status'; end if;
  select * into o from public.results_orders where id = p_order for update;
  if not found then return 'no order'; end if;
  if o.revoked_at is not null then return 'already revoked'; end if;

  update public.results_orders set status = p_status, revoked_at = now() where id = o.id;
  if not o.access_granted then return 'revoked'; end if;

  -- Same buyer, another paid order still running: move the access onto it and keep it.
  select * into other from public.results_orders
   where user_id = o.user_id and id <> o.id and status = 'paid' and revoked_at is null
     and access_until > now()
   order by access_until desc limit 1;
  if found then
    update public.results_members
       set access_source = 'stripe:' || other.id, access_until = other.access_until, updated_at = now()
     where access_source = 'stripe:' || o.id and tier = 'full';
    update public.results_members
       set access_source = 'company:' || other.id, updated_at = now()
     where access_source = 'company:' || o.id and tier = 'full';
    return 'revoked; access kept on order ' || other.id;
  end if;

  -- Ends only access this order granted (buyer and company readers), never open-ended access.
  update public.results_members
     set access_until = now(), updated_at = now()
   where access_source in ('stripe:' || o.id, 'company:' || o.id)
     and tier = 'full' and access_until is not null;
  return 'revoked';
end;
$function$;

-- 2: open-ended access is an admin decision, not tied to a purchase --------------
create or replace function public.results_set_access_until(p_email text, p_until date)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
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
         access_source = case when p_until is null or tier <> 'full' then 'admin' else access_source end,
         failed_passcode_attempts = 0,
         updated_at = now()
   where user_id = v_row.user_id;

  return v_row.email || ' has full access '
    || case when p_until is null then 'with no end date.'
            else 'through ' || to_char(p_until, 'Mon FMDD, YYYY') || '.' end;
end;
$function$;

-- 3: welcome email company paragraph (edits the live function in place) ----------
do $do$
declare
  d text := pg_get_functiondef('public.results_order_paid_email()'::regprocedure);
  old_p text := 'Up to 3 people at your company can have their own sign-in. Just reply with their work email addresses and we''''ll add them.';
  new_p text := 'You can add up to 2 colleagues who use your company email domain, each with their own sign-in. Ask them to register free at watchtoksurvey.com/results first, then reply with their email addresses and we''''ll add them. Bought with a personal email such as Gmail? Reply anyway and we''''ll sort it out.';
begin
  if position(old_p in d) = 0 then raise exception 'welcome email text not found'; end if;
  execute replace(d, old_p, new_p);
end;
$do$;

revoke all on function public.results_revoke_paid_access(uuid, text) from public, anon, authenticated;
revoke all on function public.results_set_access_until(text, date) from public, anon, authenticated;
