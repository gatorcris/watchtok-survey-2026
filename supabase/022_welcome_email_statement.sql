-- 022 (applied Nov 21, 2026): buyer welcome email says "Welcome", and tells buyers
-- their receipt/invoice come from Link and their card statement shows LINK.COM* WATCHTOK SUR.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.results_order_paid_email'::regproc);
  d := replace(d, '''subject'', ''Your WatchTok Report access is ready''', '''subject'', ''Welcome to the 2026 WatchTok Report''');
  d := replace(d, '''Your full report is ready''', '''Welcome to the WatchTok Report''');
  d := replace(d, 'Your receipt comes separately from Stripe, our payment provider.', 'Your receipt and invoice come separately from Link, our payment provider. Your card statement will show <strong>LINK.COM* WATCHTOK SUR</strong>.');
  execute d;
end $do$;
