# Survey Production Requirements V1

Status: Pre-production baseline  
Project: The 2026 WatchTok Enthusiast Survey  
Organizer: Cris Bjelajac / @GatorCris  
Target: 700 completed responses from English-speaking watch enthusiasts

## 1. Purpose

Create credible evidence that WatchTok creators provide brands with trusted access to active watch collectors and buyers. The project is creator-led and completely independent of watch brands. The primary commercial objective is to create stronger brand relationships and creator-campaign opportunities; report sales or briefings are secondary possibilities.

## 2. Participant experience

- Mobile-first, including TikTok's in-app browser.
- Most respondents should finish in about 10–15 minutes; participants should be invited to allow up to 20 minutes for thoughtful answers.
- A visible progress bar must reflect real progress.
- Required questions must be clearly identified.
- Validation errors must appear beside the affected question and must not erase answers.
- Partial progress should save automatically when the production backend supports it.
- Save-and-return should be offered without encouraging abandonment.
- Short, upbeat milestone messages should appear between major sections.
- Estimation-heavy creator questions should reassure respondents that a reasonable estimate is sufficient.
- The completion screen must connect the respondent's effort to the research purpose.

## 3. Questionnaire order

1. Collecting and purchasing
2. Next-purchase outlook
3. TikTok discovery and purchase pathway
4. Small-brand readiness and collector mindset
5. Identity, platforms, community, and content creation
6. Optional research follow-up consent

The canonical question text, response options, codes, branching, and required/optional status will be imported from the frozen questionnaire. Prototype wording must never silently become canonical.

## 4. Referral attribution

- Each Founding Creator Partner receives a unique URL and QR code.
- The public URL format should use a query parameter such as `?ref=andy`.
- Referral codes must be lowercase, normalized, allow-listed, and stored with the response session.
- Direct and unrecognized traffic must be retained as distinct categories.
- A respondent's referral source must remain stable after the first valid attribution.
- Creators receive their own referred completion count privately.
- Public reporting uses coalition-level totals; there is no public leaderboard.
- Attribution is recruitment evidence, not proof that the referring creator caused a purchase.

## 5. Data model

The production system should separate these concerns:

### Research sessions

- Random opaque session identifier
- Survey version
- Validated referral code or source category
- Started, last-updated, and completed timestamps
- Current section and last completed section
- Completion status
- Broad technical metadata needed for quality control, minimized wherever possible

### Research answers

- Session identifier
- Question code
- Canonical option code or sanitized free-text response
- Answered/updated timestamp

### Optional contact consent

- Separate record and storage policy from research answers
- Email address
- Consent purpose: future WatchTok survey invitations
- Consent timestamp and privacy-language version
- No sharing with brands or Founding Creator Partners

### Events

- Section entered
- Section completed
- Validation failure
- Save-and-return request
- Final completion
- Events must support aggregate abandonment analysis without invasive tracking

## 6. Privacy and independence

- No watch brand sponsors, commissions, reviews, or approves the questionnaire or analysis.
- Brand employees may participate as individual enthusiasts and will be identifiable analytically through the relevant questionnaire item.
- Key findings should be sensitivity-tested with and without industry-affiliated respondents.
- Individual research responses, optional emails, and individual creator referral performance must not be sold or disclosed.
- The repository must never contain production responses, emails, private exports, or privileged credentials.
- The privacy notice must state data purposes, retention, contact method, optional-email treatment, and deletion-request process before launch.
- GitHub Pages is the public interface only; private data must be written through a secure backend.

## 7. Technical architecture

### GitHub

- Repository: `gatorcris/watchtok-survey-2026`
- GitHub is the source of truth for application code, questionnaire configuration, analysis code, and deployment history.
- GitHub Actions validates and deploys the static front end.
- GitHub Pages serves the participant-facing application.

### Secure backend

- Preferred initial platform: Supabase.
- Browser submissions must use a tightly scoped public interface or server-side function.
- Row-level security must prevent participants from reading, listing, updating, or deleting other sessions.
- Service-role credentials must never appear in the browser, repository, build artifacts, or logs.
- Production and test data must be separated.

## 8. Administration and exports

- Organizer-only access to completion counts, referral summaries, abandonment summaries, and exports.
- Export research data in analysis-ready CSV format using stable question and option codes.
- Export contact-consent data separately.
- Preserve survey-version information in every export.
- Document exclusion and cleaning rules rather than altering raw data.
- Maintain recoverable backups during fielding.

## 9. Quality and launch gates

Before public launch:

- Canonical questionnaire and codebook are frozen and versioned.
- Desktop and mobile layouts are reviewed.
- TikTok in-app browser behavior is tested on iPhone and Android if available.
- Keyboard navigation and visible focus states work.
- Screen-reader labels and error messages are present.
- Progress, branching, required fields, back navigation, autosave, and resume are tested.
- Referral attribution is tested with valid, invalid, direct, and repeated links.
- Partial and completed exports reconcile with database totals.
- Optional email storage is verified as separate.
- Privacy and independence language is approved.
- Test records are removed or clearly isolated before launch.
- A small production pilot is completed before creator launch week.

## 10. Explicitly deferred

- Final questionnaire content pending the remaining pilot responses.
- Final privacy notice and retention duration.
- Supabase account and production project provisioning.
- Administrative dashboard design.
- Creator roster and allow-listed referral codes.
- Custom domain decision.
- Public-summary versus commercial-report packaging.
