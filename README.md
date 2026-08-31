# The 2026 WatchTok Enthusiast Survey

Production repository for a creator-led, brand-independent study of WatchTok enthusiasts and collectors.

## Current status

This repository contains the pre-production survey shell. It is intentionally not connected to a database and does not transmit responses. Prototype answers remain in the participant's browser.

The canonical questionnaire will be added only after pilot testing is complete and the instrument is frozen.

## Local preview

Serve the repository with any static web server, then open `index.html`. For example:

```bash
python -m http.server 8000
```

## Verification

```bash
npm test
npm run check
```

## Deployment

The included GitHub Actions workflow publishes the static site to GitHub Pages. Pages should remain disabled until the first approved preview is ready.

## Data safety

- Never commit participant responses, email addresses, credentials, or production exports.
- Never place Supabase service-role credentials in browser code or GitHub Pages files.
- Optional email addresses must be stored separately from research answers.
- The prototype is not a production data-collection system.

