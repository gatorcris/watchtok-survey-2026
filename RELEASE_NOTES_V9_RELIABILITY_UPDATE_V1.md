# V9 Reliability Update V1

This release addresses the September 14, 2026 submission incident caused by a missing PostgreSQL `UPDATE` privilege for the Supabase `authenticated` role.

## Participant safeguards

- A database synchronization failure is now shown during the survey as soon as it occurs.
- Participants can retry the save without leaving the current question.
- Participants can download a recovery copy containing their locally stored survey answers.
- Recovery copies exclude authentication tokens and contact information.

## Save reliability

- Remote saves are serialized.
- Pending autosave is cancelled before final submission.
- Authentication is checked before each write.
- A failed write renews the anonymous session and retries once.
- Failure messages include a non-sensitive diagnostic category.

## Unchanged research elements

- Survey version remains V9.
- All 43 question texts, response options, codes, ordering, and routing remain unchanged.
- Supabase tables and response schema remain unchanged.
- The Privacy Statement remains unchanged.

## Required database privilege

The production `authenticated` role must have `SELECT`, `INSERT`, and `UPDATE` on `public.survey_responses`. The included idempotent grant script and automated test preserve this requirement.
