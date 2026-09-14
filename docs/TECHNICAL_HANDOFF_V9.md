# WATCHTOK SURVEY — Technical Handoff V9

**Build date:** September 14, 2026  
**Application:** The 2026 WatchTok Enthusiast Survey  
**Deployment target:** GitHub Pages  
**Data service:** Supabase project WatchTok 2026 Survey

## What V9 contains

- The complete frozen V7 research instrument: 43 participant-facing questions with stable research IDs.
- One-question-per-screen mobile flow optimized for TikTok’s in-app browser.
- Truthful progress based on the respondent’s routed path.
- Back navigation without answer loss.
- Device-local autosave plus Supabase partial-response autosave.
- Anonymous Supabase authentication; respondents do not create or manage accounts.
- A single canonical public campaign URL with no creator attribution.
- Legacy `?ref=code` capture remains available for controlled research use and is normalized before storage.
- A visible ?test=1 mode that stores responses with is_test=true.
- Separate local progress and anonymous-authentication storage for production and test mode.
- Optional consent for future survey invitations after research completion, written to contact_optins separately.
- Test Mode displays completion but does not permit contact-information submission.
- Failed saves produce an immediate persistent warning with retry and recovery-download controls.
- Remote writes are serialized, authentication is checked before each write, and one safe retry follows a failed write.

## Live configuration

The browser uses the project’s publishable key. This key is designed for client-side use; security depends on Supabase row-level security and database grants. No secret or service-role key is included.

- Project URL: https://djupcnxgpueafhqcsmud.supabase.co
- Survey version stored with every row: V9
- Research table: survey_responses
- Optional follow-up table: contact_optins
- Private referral roster: referral_sources

## Required database contract

survey_responses uses one row per anonymous owner, survey version, and test flag:

- id uuid
- owner_id uuid
- survey_version text
- is_test boolean
- status text
- answers jsonb
- referral_code text
- last_question_id text
- last_display_question smallint
- started_at timestamptz
- updated_at timestamptz
- completed_at timestamptz

contact_optins contains:

- id uuid
- email text
- receive_report boolean
- future_research boolean
- consented_at timestamptz

The V9 client collects consent only for future survey invitations. It writes future_research=true and receive_report=false; the receive_report column remains only for database compatibility.

The existing RLS policies restrict research rows to their anonymous owner, permit updates only while a response remains partial, allow authenticated contact insertion, and expose neither individual responses nor contact records to other respondents.

## Database permission migration

Run supabase/002_authenticated_client_grants.sql once in the Supabase SQL Editor. The live smoke test identified that the original schema created correct RLS policies but did not grant the authenticated API role table privileges. RLS remains the row-level security boundary after the grants are applied.

Before promotion, run `supabase/003_reliability_health_check.sql`. `can_select`, `can_insert`, and `can_update` must all return `true`.

## Application flow

1. The app opens as a direct visit by default, then checks for saved local progress. If a controlled research URL contains a referral code, the app normalizes it before use.
2. Supabase creates or restores an anonymous authentication session.
3. The app loads the owner’s existing V9 response, if present.
4. Each answer is saved immediately on the device and debounced to Supabase. Remote writes run in order.
5. Routing writes hidden questions as SKIPPED; Q2 also receives a derived $0 marker when Q1 is “None.”
6. Final submission cancels pending autosave, renews authentication if needed, changes the row from partial to completed, and sets completed_at.
7. Only after a production completion does the separate future-survey contact form appear; Test Mode shows a disabled-contact notice instead.

## Routing implemented

- Q1 option 1 skips Q2 and derives annual watch spending as $0.
- Q37 option 7 skips Q38–Q43.
- Q12 option 1 skips Q22–Q25 and Q14–Q16.
- Q26 option 14 skips Q27–Q28.
- Q14–Q16 appear only when Q13 includes option 6.
- Display questions 12, 19, 20, and 21 enforce a maximum of three selections.
- Conflicting “None,” “not sure,” and “prefer not to answer” options are exclusive.

## Deployment

1. Apply the Supabase permission migration and run the read-only reliability health check.
2. Run `npm run check`.
3. Optionally run `npm run test:integration`; this creates one clearly marked `is_test=true` response.
4. Upload the contents of this project directory to `gatorcris/watchtok-survey-2026`.
5. Confirm GitHub Pages is still deploying from the repository root (or the chosen Pages branch).
6. Test direct, returning-partial, completed, and `?test=1` paths on iPhone and Android, including TikTok’s in-app browser.
7. Distribute only `https://watchtoksurvey.com/` and the matching generic QR asset.

## Test commands

    npm test
    npm run check
    npm run test:integration

The live integration test creates a new anonymous test identity, saves a partial row, reads it back, and completes it. It does not insert an optional contact record.

## Privacy and operations

- The app does not ask for name or TikTok handle.
- Optional email is used only for future survey invitations, stored separately, and never placed inside answers.
- The public client has no delete permission and cannot list another owner’s responses.
- The service-role key must never be placed in this repository.
- Test and production rows are separated by is_test and by browser-storage scope.
- Recovery downloads contain local survey state only. They exclude authentication tokens and contact information.
- Before launch, approve final privacy/retention language and establish an organizer process for deletion requests sent to watchtoksurvey@gmail.com.

## Final campaign decisions

- The public brand is **WATCHTOK SURVEY**.
- Founding Creators receive the same canonical URL and creator-neutral QR asset.
- Individual creator traffic attribution is not part of the public campaign.
- The site remains `noindex,nofollow` during private coordination; direct links and QR codes continue to work.
- Remove the indexing restriction only if organic search discovery is desired at public launch.
- A production mobile QA pass in the TikTok in-app browser remains a launch gate.
