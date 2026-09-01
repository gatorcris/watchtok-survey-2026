-- WatchTok Survey V8 browser-role grants
-- Required because tables created through the SQL editor do not automatically
-- receive API privileges even when row-level security policies already exist.

begin;

grant usage on schema public to authenticated;
grant select, insert, update on table public.survey_responses to authenticated;
grant insert on table public.contact_optins to authenticated;

-- Intentionally omitted:
-- * DELETE on all respondent-facing tables
-- * SELECT/UPDATE/DELETE on contact_optins
-- * all respondent access to referral_sources
-- RLS remains enabled and continues to restrict each survey response to auth.uid().

commit;

select
  'WatchTok V8 authenticated client grants applied successfully' as result;
