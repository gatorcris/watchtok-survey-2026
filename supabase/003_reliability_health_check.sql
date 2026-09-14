-- Read-only WatchTok Survey V9 permission check.
-- All three values must be true before public promotion.

select
  has_table_privilege('authenticated', 'public.survey_responses', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.survey_responses', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.survey_responses', 'UPDATE') as can_update;
