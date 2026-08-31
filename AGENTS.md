# Repository expectations

## Purpose

Build and maintain The 2026 WatchTok Enthusiast Survey as a mobile-first, accessible, creator-led research experience.

## Non-negotiable research rules

- Preserve canonical question wording and option order once the questionnaire is frozen.
- Distinguish stated purchase outlook from prediction or demonstrated conversion.
- Keep optional contact information separate from research responses.
- Do not expose individual responses or individual creator referral performance publicly.
- Do not imply brand sponsorship, commissioning, review, or approval.
- Treat referral attribution as coalition measurement, not a public leaderboard.

## Product rules

- Optimize first for TikTok's in-app mobile browser.
- Display a truthful progress indicator.
- Save partial progress and support returning where feasible.
- Use short, encouraging transitions between sections.
- Keep the next-purchase block immediately after collecting and purchasing.
- Do not transmit data until the production backend, privacy language, and consent controls are approved.

## Engineering rules

- Run `npm run check` before committing.
- Never commit credentials, response exports, or personally identifying participant data.
- Keep the GitHub Pages front end static and put privileged operations behind a server-side endpoint.
- Preserve URL referral codes only after validating and normalizing them.

