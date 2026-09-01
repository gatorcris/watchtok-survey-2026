# WatchTok Survey V8 Test Report

**Test date:** September 1, 2026

## Static and unit checks

Command: npm run check

- JavaScript syntax checks: passed
- Automated tests: 14 passed, 0 failed
- Frozen questionnaire: 43 questions confirmed in display order
- Conditional routing: passed
- SKIPPED serialization and derived Q2 spend: passed
- Multi-select exclusivity and three-choice limits: passed
- Routed-path progress calculation: passed
- Production/test browser-state separation: passed
- Approved V3 wording, public email, and logo asset checks: passed

## Live Supabase smoke test

Passed after the authenticated-client permission migration was applied.

- Anonymous sign-in: passed
- Partial test-response insert: passed
- Owner-only response read: passed
- Completion update using the schema value completed: passed
- Test-data separation: confirmed is_test=true
- Contact opt-in insertion: intentionally not performed

The final completed V3 smoke-test response ID was a35e4629-3fe9-4cf4-a055-d5ce90282976.
