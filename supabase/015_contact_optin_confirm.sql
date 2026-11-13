-- WatchTok Survey — double opt-in for the email list (security review M4)
-- Run once in the Supabase SQL Editor, AFTER confirm.html is live on the site
-- and with the Resend key already in the Vault (see 012). Safe to re-run.
--
-- What it does
-- 1. Each new sign-up gets a secret confirm token. The browser can only send
--    email + consent fields; it can never set the token or mark itself confirmed.
-- 2. Supabase emails a "confirm your email" link through Resend
--    (from results@watchtoksurvey.com) to watchtoksurvey.com/confirm.html?t=<token>.
-- 3. Clicking it marks the address confirmed (confirmed_at).
--
-- ONLY MAIL ADDRESSES WHERE confirmed_at IS NOT NULL.
-- Sign-ups from before this script (legacy) have no confirmation. Their first
-- 2027 email should itself ask them to confirm; don't mail them otherwise.
--
-- Each address can sign up once (existing unique index on lower(trim(email))),
-- so nobody can be sent more than one confirmation email through the form.

begin;

create extension if not exists pg_net with schema extensions;

alter table public.contact_optins
  add column if not exists confirm_token uuid not null default gen_random_uuid(),
  add column if not exists confirm_sent_at timestamptz,
  add column if not exists confirmed_at timestamptz;

create unique index if not exists contact_optins_confirm_token_idx
  on public.contact_optins (confirm_token);

-- Browser may insert only these columns (not the token or confirmation).
revoke insert on public.contact_optins from authenticated;
grant insert (email, receive_report, future_research, consented_at)
  on public.contact_optins to authenticated;

-- Send the confirmation email after a sign-up.
create or replace function public.contact_optin_send_confirm()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_key text;
  v_link text;
begin
  begin
    select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    if v_key is null then
      raise warning 'contact_optin_send_confirm: no resend_api_key in Vault; email skipped';
      return new;
    end if;

    v_link := 'https://watchtoksurvey.com/confirm.html?t=' || new.confirm_token::text;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'WatchTok Survey <results@watchtoksurvey.com>',
        'to', jsonb_build_array(new.email),
        'reply_to', 'watchtoksurvey@gmail.com',
        'subject', 'Confirm your email for the 2027 WatchTok survey',
        'html',
          '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">'
          || '<p>Thanks for signing up to hear when the 2027 WatchTok survey opens.</p>'
          || '<p><a href="' || v_link || '" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">Confirm my email</a></p>'
          || '<p>We only use your email for WatchTok survey news. It is never shared with brands or creators.</p>'
          || '<p style="color:#6b7280;font-size:13px">Didn''t sign up? Ignore this email and you won''t hear from us.</p>'
          || '</div>',
        'text',
          'Thanks for signing up to hear when the 2027 WatchTok survey opens.' || chr(10) || chr(10)
          || 'Confirm your email: ' || v_link || chr(10) || chr(10)
          || 'Didn''t sign up? Ignore this email and you won''t hear from us.'
      )
    );

    update public.contact_optins set confirm_sent_at = now() where id = new.id;
  exception when others then
    -- Never block the sign-up because of an email problem.
    raise warning 'contact_optin_send_confirm failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.contact_optin_send_confirm() from public, anon, authenticated;

drop trigger if exists contact_optin_confirm_email on public.contact_optins;
create trigger contact_optin_confirm_email
  after insert on public.contact_optins
  for each row execute function public.contact_optin_send_confirm();

-- Called by confirm.html. Reveals nothing about the address.
create or replace function public.confirm_contact_optin(p_token uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.contact_optins%rowtype;
begin
  select * into v_row from public.contact_optins where confirm_token = p_token;
  if not found then
    return 'invalid';
  end if;
  if v_row.confirmed_at is not null then
    return 'already';
  end if;
  update public.contact_optins set confirmed_at = now() where id = v_row.id;
  return 'confirmed';
end;
$$;

revoke all on function public.confirm_contact_optin(uuid) from public;
grant execute on function public.confirm_contact_optin(uuid) to anon, authenticated;

commit;

select 'WatchTok email double opt-in installed' as result;
