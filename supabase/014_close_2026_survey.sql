-- WatchTok Survey — close the 2026 survey at the database (security review H1)
-- Run once in the Supabase SQL Editor, AFTER the "survey closed" site change is live.
-- Safe to re-run.
--
-- The site already hides the survey (SURVEY_CLOSED in src/config.js), but the
-- database would still accept a scripted response. This makes the database
-- refuse any NEW or CHANGED real (non-test) response. Test responses
-- (?test=1, is_test = true) still save, so the survey can be developed.
--
-- Existing responses are untouched. The report uses the first 309 completed.
--
-- TO REOPEN FOR 2027: replace the two policies below with versions that allow
-- the new survey_version (e.g. "is_test = true or survey_version = 'V10'"),
-- after the survey integrity fixes in claude/survey-integrity-plan.md.

begin;

drop policy if exists "Respondents can create their own response" on public.survey_responses;
create policy "Respondents can create their own response"
  on public.survey_responses for insert to authenticated
  with check (owner_id = (select auth.uid()) and is_test = true);

drop policy if exists "Respondents can update an incomplete response" on public.survey_responses;
create policy "Respondents can update an incomplete response"
  on public.survey_responses for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'partial' and is_test = true)
  with check (owner_id = (select auth.uid()) and is_test = true);

commit;

select 'WatchTok 2026 survey closed at the database (test responses still allowed)' as result;
