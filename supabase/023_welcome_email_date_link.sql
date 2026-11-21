-- 023 (applied Nov 21, 2026): welcome + sale emails showed access ending one day late
-- (access_until is stored as midnight ET after the last day). Subtract 1 second before
-- formatting, as results/app.js already does. Also stop Gmail auto-linking LINK.COM.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.results_order_paid_email'::regproc);
  d := replace(d, 'to_char(new.access_until at time zone ''America/New_York''', 'to_char((new.access_until - interval ''1 second'') at time zone ''America/New_York''');
  d := replace(d, '<strong>LINK.COM* WATCHTOK SUR</strong>', '<strong>LINK&#8203;.&#8203;COM* WATCHTOK SUR</strong>');
  execute d;
end $do$;
