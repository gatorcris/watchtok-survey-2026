-- 021: weekly off-site backup. Every Sunday 8am ET the database emails a JSON
-- copy of every public table (plus sign-in accounts) to Cris's 2-step Gmail.
-- Run by hand any time:  select public.results_weekly_backup();
create extension if not exists pg_cron;

create or replace function public.results_weekly_backup()
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_key text; v_doc jsonb := '{}'::jsonb; v_rows jsonb; v_t record;
  v_counts text := ''; v_file text; v_stamp text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null then raise exception 'backup: no resend_api_key'; end if;

  for v_t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', v_t.tablename) into v_rows;
    v_doc := v_doc || jsonb_build_object(v_t.tablename, v_rows);
    v_counts := v_counts || '<tr><td>' || v_t.tablename || '</td><td align="right">' || jsonb_array_length(v_rows) || '</td></tr>';
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'created_at', created_at,
           'email_confirmed_at', email_confirmed_at, 'last_sign_in_at', last_sign_in_at)), '[]'::jsonb)
    into v_rows from auth.users;
  v_doc := v_doc || jsonb_build_object('auth_users', v_rows);
  v_counts := v_counts || '<tr><td>auth_users (sign-in accounts)</td><td align="right">' || jsonb_array_length(v_rows) || '</td></tr>';

  v_stamp := to_char(now() at time zone 'America/New_York', 'YYYY-MM-DD');
  v_doc := jsonb_build_object('backup_of', 'watchtoksurvey.com (Supabase djupcnxgpueafhqcsmud)',
                              'taken_at', now(), 'tables', v_doc);
  v_file := 'watchtok-backup-' || v_stamp || '.json';

  perform net.http_post(url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'WatchTok Survey Results <results@watchtoksurvey.com>',
      'to', jsonb_build_array('bjelajac.cristopher@gmail.com'),
      'subject', 'WatchTok weekly backup ' || v_stamp,
      'attachments', jsonb_build_array(jsonb_build_object('filename', v_file,
         'content', replace(encode(convert_to(v_doc::text, 'UTF8'), 'base64'), E'\n', ''))),
      'html', public.wt_email_html('Weekly database backup attached.', 'Weekly backup',
         '<p style="margin:0 0 12px">The attached file is a full copy of the watchtoksurvey.com database as of '
         || v_stamp || '. Keep this email; nothing needs doing.</p>'
         || '<table cellpadding="4" style="font:400 14px Arial,Helvetica,sans-serif;color:#22252B">' || v_counts || '</table>',
         null, null,
         '<p style="margin:16px 0 0;font-size:13px;color:#6B7280">Contains buyer and survey data. Do not forward.</p>', true)));
  return v_file;
end;
$$;

revoke all on function public.results_weekly_backup() from public, anon, authenticated;

select cron.schedule('watchtok-weekly-backup', '0 13 * * 0', 'select public.results_weekly_backup();');
