-- 020_branded_emails.sql
-- Gives every email the database sends the WatchTok look approved Nov 18, 2026
-- (navy header with the dial mark, white card, gold button, "WatchTok Survey · Westford, Massachusetts" footer).
-- Replaces the email bodies in 012 (access-request alert), 015 (2027 list confirmation) and 018 (welcome + sale alert).
-- Nothing else changes: same triggers, same senders, same subjects. Run once in the SQL Editor. Safe to re-run.

begin;

create or replace function public.wt_esc(p text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- p_btn_text null = no button. p_internal = alerts to Cris (short footer).
create or replace function public.wt_email_html(p_pre text, p_heading text, p_body text,
  p_btn_text text default null, p_btn_url text default null, p_after text default '', p_internal boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  if p_internal then
    v := $T$<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F4F1EA">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">@@PRE@@</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E6E0D2">
<tr><td style="background:#111827;padding:18px 26px"><img src="https://watchtoksurvey.com/assets/email/watchtok-mark-192.png" width="36" height="36" alt="" style="vertical-align:middle;border:0"><span style="display:inline-block;vertical-align:middle;margin-left:10px;font:700 12px Arial,Helvetica,sans-serif;letter-spacing:2px;color:#FFFDF8">WATCHTOK SURVEY</span></td></tr>
<tr><td style="padding:28px 26px 26px;font:400 15px/1.55 Arial,Helvetica,sans-serif;color:#22252B">
<h1 style="margin:0 0 14px;font:700 24px/1.25 Georgia,'Times New Roman',serif;color:#111827">@@HEADING@@</h1>
@@BODY@@@@AFTER@@
</td></tr>
<tr><td style="padding:16px 26px 22px;border-top:1px solid #EEE8DA;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6B7280">Internal alert from watchtoksurvey.com</td></tr>
</table></td></tr></table></body></html>$T$;
  else
    v := $T$<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F4F1EA">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">@@PRE@@</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E6E0D2">
<tr><td style="background:#111827;padding:18px 26px"><img src="https://watchtoksurvey.com/assets/email/watchtok-mark-192.png" width="36" height="36" alt="" style="vertical-align:middle;border:0"><span style="display:inline-block;vertical-align:middle;margin-left:10px;font:700 12px Arial,Helvetica,sans-serif;letter-spacing:2px;color:#FFFDF8">WATCHTOK SURVEY</span></td></tr>
<tr><td style="padding:28px 26px 26px;font:400 15px/1.55 Arial,Helvetica,sans-serif;color:#22252B">
<h1 style="margin:0 0 14px;font:700 24px/1.25 Georgia,'Times New Roman',serif;color:#111827">@@HEADING@@</h1>
@@BODY@@@@BUTTON@@@@AFTER@@
</td></tr>
<tr><td style="padding:16px 26px 22px;border-top:1px solid #EEE8DA;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6B7280"><strong style="color:#22252B">WatchTok Survey</strong> · Westford, Massachusetts<br><a href="https://watchtoksurvey.com" style="color:#6B7280">watchtoksurvey.com</a> · <a href="https://watchtoksurvey.com/privacy.html" style="color:#6B7280">Privacy</a> · Questions? <a href="mailto:watchtoksurvey@gmail.com" style="color:#6B7280">watchtoksurvey@gmail.com</a></td></tr>
</table></td></tr></table></body></html>$T$;
    v := replace(v, '@@BUTTON@@', case when p_btn_text is null then '' else
      replace(replace($T$<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:#B8860B;border-radius:9px"><a href="@@BTN_URL@@" style="display:inline-block;padding:13px 24px;font:700 15px Arial,Helvetica,sans-serif;color:#111827;text-decoration:none">@@BTN_TEXT@@</a></td></tr></table>$T$, '@@BTN_TEXT@@', p_btn_text), '@@BTN_URL@@', p_btn_url) end);
  end if;
  v := replace(v, '@@PRE@@', coalesce(p_pre, ''));
  v := replace(v, '@@HEADING@@', coalesce(p_heading, ''));
  v := replace(v, '@@BODY@@', coalesce(p_body, ''));
  v := replace(v, '@@AFTER@@', coalesce(p_after, ''));
  return v;
end;
$$;
revoke all on function public.wt_email_html(text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.wt_esc(text) from public, anon, authenticated;

-- 012: full-access request alert (to Cris)
create or replace function public.results_notify_access_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_key text; v_member public.results_members%rowtype; v_type text; v_html text;
begin
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    if v_key is null then raise warning 'results_notify_access_request: no resend_api_key'; return new; end if;
    select * into v_member from public.results_members where user_id = new.user_id;
    v_type := case v_member.member_type when 'brand' then 'Watch brand' when 'creator' then 'WatchTok creator'
      when 'team' then 'Founding WatchTok team' else 'Other' end;
    v_html := public.wt_email_html('Someone asked for full access.', 'New full-access request',
      '<table cellpadding="5" style="font:400 14px Arial,Helvetica,sans-serif;color:#22252B">'
      || '<tr><td><b>Name</b></td><td>' || public.wt_esc(v_member.full_name) || '</td></tr>'
      || '<tr><td><b>Email</b></td><td>' || public.wt_esc(v_member.email) || '</td></tr>'
      || '<tr><td><b>Organization</b></td><td>' || coalesce(nullif(public.wt_esc(v_member.organization), ''), '—') || '</td></tr>'
      || '<tr><td><b>I am a</b></td><td>' || v_type || '</td></tr>'
      || '<tr><td><b>Came from</b></td><td>' || public.wt_esc(coalesce(new.source, 'direct link')) || '</td></tr>'
      || '<tr><td><b>Report version</b></td><td>' || public.wt_esc(coalesce(new.results_version, '—')) || '</td></tr>'
      || '<tr><td><b>Requested</b></td><td>' || to_char(new.first_requested_at at time zone 'America/New_York', 'Mon DD, YYYY HH12:MI AM') || ' ET</td></tr>'
      || '</table>',
      null, null,
      '<p style="margin:16px 0 0;font-size:13px;color:#6B7280">Reply to this email to answer them directly.</p>', true);
    perform net.http_post(url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', 'WatchTok Survey Results <results@watchtoksurvey.com>',
        'to', jsonb_build_array('watchtoksurvey@gmail.com'), 'reply_to', v_member.email,
        'subject', 'Full-access request: ' || coalesce(nullif(v_member.organization, ''), v_member.full_name, v_member.email),
        'html', v_html));
  exception when others then raise warning 'results_notify_access_request failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 015: 2027 survey list confirmation
create or replace function public.contact_optin_send_confirm()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_key text; v_link text;
begin
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    if v_key is null then raise warning 'contact_optin_send_confirm: no resend_api_key'; return new; end if;
    v_link := 'https://watchtoksurvey.com/confirm.html?t=' || new.confirm_token::text;
    perform net.http_post(url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', 'WatchTok Survey <results@watchtoksurvey.com>',
        'to', jsonb_build_array(new.email),
        'subject', 'Confirm your email for the 2027 WatchTok survey',
        'html', public.wt_email_html('Confirm to hear first when the 2027 survey opens.', 'You''re almost on the list',
          '<p style="margin:0 0 12px">Thanks for signing up to hear when the <strong>2027 WatchTok survey</strong> opens.</p>'
          || '<p style="margin:0 0 12px">We only use your email for WatchTok survey news. It is never shared with brands or creators.</p>',
          'Confirm my email', v_link,
          '<p style="margin:16px 0 0;font-size:13px;color:#6B7280">Didn''t sign up? Ignore this email and you won''t hear from us.</p>'),
        'text', 'Thanks for signing up to hear when the 2027 WatchTok survey opens.' || chr(10) || chr(10)
          || 'Confirm your email: ' || v_link || chr(10) || chr(10)
          || 'Didn''t sign up? Ignore this email and you won''t hear from us.' || chr(10) || chr(10)
          || 'WatchTok Survey · Westford, Massachusetts · watchtoksurvey.com'));
    update public.contact_optins set confirm_sent_at = now() where id = new.id;
  exception when others then raise warning 'contact_optin_send_confirm failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 018: welcome email to the buyer + "New sale" alert to Cris
create or replace function public.results_order_paid_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_key text; v_until text; v_name text; v_email text; v_code text;
begin
  if not (new.status = 'paid' and new.access_until is not null and old.access_until is null) then return new; end if;
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    if v_key is null then raise warning 'order email: no resend_api_key'; return new; end if;
    v_until := to_char(new.access_until at time zone 'America/New_York', 'FMMonth FMDD, YYYY');
    v_name := public.wt_esc(new.buyer_name); v_email := public.wt_esc(new.email);
    v_code := case when new.code is null then 'none'
      when new.code_kind = 'discount' then public.wt_esc(new.code) || ' · discount code, $'
        || to_char(coalesce(new.amount_discount, 0) / 100.0, 'FM999,990') || ' off'
      else public.wt_esc(new.code) || ' · referral code, no discount' end;

    perform net.http_post(url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', 'WatchTok Survey <results@watchtoksurvey.com>',
        'to', jsonb_build_array(new.email), 'reply_to', 'watchtoksurvey@gmail.com',
        'subject', 'Your WatchTok Report access is ready',
        'html', public.wt_email_html('Full access is on, through ' || v_until || '.', 'Your full report is ready',
          '<p style="margin:0 0 12px">Hi ' || v_name || ',</p>'
          || '<p style="margin:0 0 12px">Thank you for buying the <strong>2026 WatchTok Report</strong>. Your full access is active now and runs through <strong>' || v_until || '</strong>.</p>'
          || '<p style="margin:0 0 12px">Sign in with <strong>' || v_email || '</strong> to read it. Forgot your password? Use “Forgot your password?” on the sign-in page.</p>',
          'Open the full report', 'https://watchtoksurvey.com/results/',
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 14px;background:#F4F1EA;border-radius:10px"><tr><td style="padding:16px 18px;font:400 14px/1.55 Arial,Helvetica,sans-serif;color:#22252B"><strong style="color:#111827">A free 30-minute walkthrough</strong><br>If it would help to talk through the findings for your brand, <a href="https://calendar.app.google/bgZMVqnmMMFhTGcu5" style="color:#B8860B;font-weight:700">book a time here</a> (Google Meet).</td></tr></table>'
          || case when new.license = 'company' then '<p style="margin:0 0 12px"><strong>Buying for a brand?</strong> Up to 3 people at your company can have their own sign-in. Just reply with their work email addresses and we''ll add them.</p>' else '' end
          || '<p style="margin:0 0 12px;font-size:14px;color:#6B7280">Your receipt comes separately from Stripe, our payment provider.</p>'
          || '<p style="margin:0 0 12px">Questions? Just reply to this email.</p>'
          || '<p style="margin:16px 0 0">Cris Bjelajac<br><span style="color:#6B7280">WatchTok Survey</span></p>')));

    perform net.http_post(url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', 'WatchTok Survey Results <results@watchtoksurvey.com>',
        'to', jsonb_build_array('watchtoksurvey@gmail.com'), 'reply_to', new.email,
        'subject', 'New sale: ' || coalesce(new.brand_name, new.buyer_name)
                   || case when new.code is not null then ' (code ' || new.code || ')' else '' end,
        'html', public.wt_email_html('New sale on watchtoksurvey.com', 'New sale',
          '<table cellpadding="5" style="font:400 14px Arial,Helvetica,sans-serif;color:#22252B">'
          || '<tr><td><b>Buyer name</b></td><td>' || v_name || '</td></tr>'
          || '<tr><td><b>Buyer email</b></td><td>' || v_email || '</td></tr>'
          || '<tr><td><b>Brand</b></td><td>' || coalesce(public.wt_esc(new.brand_name) || ' (company license)', '— (personal license)') || '</td></tr>'
          || '<tr><td><b>Code</b></td><td>' || v_code || '</td></tr>'
          || '<tr><td><b>Referred by</b></td><td>' || coalesce(public.wt_esc(new.referrer_label), '—') || '</td></tr>'
          || '<tr><td><b>Collected</b></td><td>' || to_char((coalesce(new.amount_total,0) - coalesce(new.amount_tax,0)) / 100.0, 'FM$999,990.00') || ' ' || upper(coalesce(new.currency, 'usd')) || ' before tax</td></tr>'
          || '<tr><td><b>Access through</b></td><td>' || v_until || '</td></tr></table>',
          null, null,
          '<p style="margin:16px 0 0;font-size:13px;color:#6B7280">Reply to this email to write to the buyer.</p>', true)));
  exception when others then raise warning 'results_order_paid_email failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.results_notify_access_request() from public, anon, authenticated;
revoke all on function public.contact_optin_send_confirm() from public, anon, authenticated;
revoke all on function public.results_order_paid_email() from public, anon, authenticated;

commit;

select 'WatchTok branded emails installed' as result;
