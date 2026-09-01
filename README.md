# The 2026 WatchTok Enthusiast Survey — V8

Deployment-ready static survey client for GitHub Pages with Supabase anonymous authentication, partial-response autosave, routed completion, referral attribution, test-mode separation, and separate optional contact consent.

## V3 test-build updates

- Production and `?test=1` now use separate browser progress and anonymous-authentication storage.
- The approved optional-follow-up wording and public contact address are in place.
- The header and favicon use the independent-research watch/data mark.
- The live Supabase create/read/complete round trip passed after these changes.

## Verify

    npm run check

After applying supabase/002_authenticated_client_grants.sql, run the live round-trip test:

    npm run test:integration

## Deploy

Upload the project contents to gatorcris/watchtok-survey-2026 and enable GitHub Pages. The participant client requires no build step.

- Normal survey: https://pages-host/watchtok-survey-2026/
- Creator referral: add ?ref=lowercase-code
- Test response: add ?test=1

See docs/TECHNICAL_HANDOFF_V8.md for the database contract, routing, permissions, QA gates, and launch checklist.
