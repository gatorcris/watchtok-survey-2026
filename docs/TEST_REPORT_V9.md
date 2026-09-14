# WATCHTOK SURVEY V9 Test Report

**Test date:** September 5, 2026

## Static and unit checks

Command: npm run check

- JavaScript syntax checks: passed
- Automated tests: 21 passed, 0 failed
- Frozen questionnaire: 43 questions confirmed in display order
- Conditional routing: passed
- SKIPPED serialization and derived Q2 spend: passed
- Multi-select exclusivity and three-choice limits: passed
- Routed-path progress calculation: passed
- Production/test browser-state separation: passed
- V9 survey identity and browser-storage namespace: passed
- Approved interstitial wording: passed
- Single clean instruction rendering across question types: passed
- Future-surveys-only contact consent: passed
- Test Mode contact-entry prevention: passed
- Public email, WATCHTOK SURVEY wordmark, and logo asset checks: passed
- Canonical public URL and prelaunch indexing controls: passed
- Generic QR source contains no creator referral parameter or creator identifier: passed

## Live Supabase smoke test

Passed after the authenticated-client permission migration was applied.

- Anonymous sign-in: passed
- Partial test-response insert: passed
- Owner-only response read: passed
- Completion update using the schema value completed: passed
- Test-data separation: confirmed is_test=true
- Contact opt-in insertion: intentionally not performed

The last completed live smoke-test response ID from V8 was `ce7655ed-c36f-4e44-a419-a6caadd29c74`. A new V9 live smoke test is optional because the database contract is unchanged; if run, record its test-only response ID here.
