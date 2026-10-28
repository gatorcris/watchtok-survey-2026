-- Read-only WatchTok Survey V9 permission check.
-- All four values must be true before public promotion, and after any
-- permission or schema change in Supabase.
--
-- can_save_email covers the optional email box at the end of the survey.
-- It was missing from Sep 13 to Oct 28, 2026, so emails silently failed to
-- save while survey answers kept working. If it is false, run:
--   grant insert on table public.contact_optins to authenticated;

select
  has_table_privilege('authenticated', 'public.survey_responses', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.survey_responses', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.survey_responses', 'UPDATE') as can_update,
  has_table_privilege('authenticated', 'public.contact_optins', 'INSERT') as can_save_email;
