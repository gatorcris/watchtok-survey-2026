# WATCHTOK SURVEY V9 Deployment Checklist

## Before upload

- Confirm the live V9 survey is not being actively used for production responses during the update window.
- Keep the existing hosted Founding Creator briefing PDF in the repository.
- Run `supabase/003_reliability_health_check.sql`; all three values must be `true`.
- Run `npm run check` from the V9 project folder; all 26 checks must pass.

## Upload

Upload the V9 project contents to the existing `gatorcris/watchtok-survey-2026` repository. Replace files with the same paths and add the new V9 files, especially:

- `index.html`
- `styles.css`
- `src/config.js`
- `src/reliability.js`
- `src/storage.js`
- `src/survey.js`
- `assets/watchtok-research-mark.svg`
- `assets/watchtok-survey-social.png`
- `assets/watchtok-survey-qr-mobile.png`
- `tests/v9-content.test.js`
- `tests/reliability.test.js`
- `README.md`

Do not delete the already hosted `watchtok-survey-founding-creator-briefing-v2.pdf`.

## After GitHub Pages publishes

1. Open `https://watchtoksurvey.com/` in a private browser window.
2. Confirm the header reads **WATCHTOK SURVEY**.
3. Start a Test Mode response at `https://watchtoksurvey.com/?test=1` and verify the first question loads.
4. Open `https://watchtoksurvey.com/assets/watchtok-survey-qr-mobile.png` and save it to a phone.
5. Scan or long-press the QR code and confirm it opens exactly `https://watchtoksurvey.com/` with no `?ref=` parameter.
6. Paste the survey URL into a message draft and confirm the WATCHTOK SURVEY preview appears after platform caches refresh.
7. Open the Founding Creator briefing at `https://watchtoksurvey.com/watchtok-survey-founding-creator-briefing-v2.pdf`.
8. Confirm a Test Mode response creates a partial row, updates it, and completes it.

## Launch indexing decision

The final candidate intentionally keeps the site out of search results with both `index.html` and `robots.txt`. Direct URLs and QR scans still work. When organic search discovery is desired, remove the `noindex,nofollow` meta tag and change `robots.txt` from `Disallow: /` to `Allow: /` in a separately versioned release.
