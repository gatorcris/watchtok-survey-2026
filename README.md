# WATCHTOK SURVEY — V9 Reliability Update V1

Deployment-ready static survey client for GitHub Pages with Supabase anonymous authentication, partial-response autosave, routed completion, test-mode separation, and separate optional contact consent.

## Reliability update

- Serializes database saves so a delayed partial save cannot follow final completion.
- Renews the anonymous session and retries one failed database write once.
- Warns participants as soon as synchronization fails instead of waiting until final submission.
- Provides retry and local recovery-download controls without including authentication credentials.
- Preserves the complete V9 questionnaire, routing, answer codes, privacy page, and database schema.
- Verifies the required authenticated `SELECT`, `INSERT`, and `UPDATE` grant in the automated test suite.

## V9 final-candidate updates

- The primary wordmark is now **WATCHTOK SURVEY** across the participant experience.
- The official public campaign uses one canonical, untagged URL: `https://watchtoksurvey.com/`.
- The companion QR asset points to that same canonical URL and contains no creator-specific attribution.
- Internal CSS and test language no longer refer to the release as a prototype.
- Browser progress and anonymous-authentication storage are versioned for V9.
- Legacy `?ref=` handling remains in place for controlled research use, but referral links are not part of the official public distribution plan.

Rebuild the two campaign graphics with `python3 scripts/build-qr-card.py` and `python3 scripts/build-social-card.py`. Both scripts use Pillow; the QR builder also uses ReportLab.

## Verify

    npm run check

After applying `supabase/002_authenticated_client_grants.sql`, the optional live round-trip test is:

    npm run test:integration

The live test creates one clearly marked `is_test=true` response.

## Deploy

Upload the project contents to `gatorcris/watchtok-survey-2026`. GitHub Pages serves the participant client directly; there is no build step.

- Official survey: https://watchtoksurvey.com/
- Creator-neutral QR card: https://watchtoksurvey.com/assets/watchtok-survey-qr-mobile.png
- Test response: https://watchtoksurvey.com/?test=1
- Founding Creator briefing: https://watchtoksurvey.com/watchtok-survey-founding-creator-briefing-v2.pdf

The site intentionally remains `noindex,nofollow` until the coordinated public launch. Direct links and QR codes work normally while indexing is disabled. Remove the robots restrictions only if organic search discovery is desired.

See `docs/TECHNICAL_HANDOFF_V9.md` for the database contract, routing, privacy controls, QA gates, and launch checklist.
