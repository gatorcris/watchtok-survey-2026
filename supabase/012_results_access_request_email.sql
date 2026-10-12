-- WatchTok Survey RESULTS — email alert for "Request full access"
-- Run once in the Supabase SQL Editor, AFTER 011_results_access_requests.sql
-- and AFTER storing your Resend API key in the Vault (see docs/RESULTS_SETUP.md).
-- Safe to re-run.
--
-- When a preview viewer taps "Request full access" for the first time, Supabase
-- emails watchtoksurvey@gmail.com through Resend (from results@watchtoksurvey.com),
-- with Reply-To set to the requester so you can answer with one click.
--
-- The email is queued in the background (pg_net). If Resend is down or the key
-- is missing, the request is still saved; only the email is skipped.

begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.results_notify_access_request()
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
  begin
    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'resend_api_key'
    limit 1;

    if v_key is null then
      raise warning 'results_notify_access_request: no resend_api_key in Vault; email skipped';
      return new;
    end if;

    select * into v_member from public.results_members where user_id = new.user_id;

    v_type := case v_member.member_type
      when 'brand' then 'Watch brand'
      when 'creator' then 'WatchTok creator'
      when 'team' then 'Founding WatchTok team'
      else 'Other' end;

    v_html :=
      '<p><strong>New full-access request</strong> on watchtoksurvey.com/results</p>'
      || '<table cellpadding="4" style="font-family:Arial,sans-serif;font-size:14px">'
      || '<tr><td><b>Name</b></td><td>' || coalesce(replace(replace(v_member.full_name, '<', '&lt;'), '>', '&gt;'), '') || '</td></tr>'
      || '<tr><td><b>Email</b></td><td>' || coalesce(replace(replace(v_member.email, '<', '&lt;'), '>', '&gt;'), '') || '</td></tr>'
      || '<tr><td><b>Organization</b></td><td>' || coalesce(replace(replace(v_member.organization, '<', '&lt;'), '>', '&gt;'), '—') || '</td></tr>'
      || '<tr><td><b>I am a</b></td><td>' || v_type || '</td></tr>'
      || '<tr><td><b>Came from</b></td><td>' || coalesce(new.source, 'direct link') || '</td></tr>'
      || '<tr><td><b>Report version</b></td><td>' || coalesce(new.results_version, '—') || '</td></tr>'
      || '<tr><td><b>Requested</b></td><td>' || to_char(new.first_requested_at at time zone 'America/New_York', 'Mon DD, YYYY HH12:MI AM') || ' ET</td></tr>'
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
        'subject', 'Full-access request: ' || coalesce(nullif(v_member.organization, ''), v_member.full_name, v_member.email),
        'html', v_html
      )
    );
  exception when others then
    -- Never block saving the request because of an email problem.
    raise warning 'results_notify_access_request failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.results_notify_access_request() from public, anon, authenticated;

drop trigger if exists results_access_request_email on public.results_access_requests;
create trigger results_access_request_email
  after insert on public.results_access_requests
  for each row execute function public.results_notify_access_request();

commit;

select 'WatchTok request-access email alert installed' as result;
