# WatchTok Survey V8 Test Report

**Test date:** September 1, 2026

## Static and unit checks

Command: npm run check

- JavaScript syntax checks: passed
- Automated tests: 10 passed, 0 failed
- Frozen questionnaire: 43 questions confirmed in display order
- Conditional routing: passed
- SKIPPED serialization and derived Q2 spend: passed
- Multi-select exclusivity and three-choice limits: passed
- Routed-path progress calculation: passed

## Live Supabase smoke test

Passed after the authenticated-client permission migration was applied.

- Anonymous sign-in: passed
- Partial test-response insert: passed
- Owner-only response read: passed
- Completion update using the schema value completed: passed
- Test-data separation: confirmed is_test=true
- Contact opt-in insertion: intentionally not performed

The final completed smoke-test response ID was 4b5861f9-72cc-4578-967e-b1f7eaadac7b.
