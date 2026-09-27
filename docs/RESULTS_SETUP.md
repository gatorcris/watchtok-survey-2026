# WatchTok Survey Results — Setup Guide (Collaborator Launch)

The results live at **https://watchtoksurvey.com/results/**. The page itself is public, but it shows nothing until someone registers. What each account can see is enforced by Supabase, not by the web page.

| Who | How they get in | What they see |
|---|---|---|
| Brands, anyone | Create a free account | Preview: headline market sizing + the five personas |
| Collaborators (creators, Founding team) | Create an account **with the passcode** | Full report |
| Cris | Full access, then promoted to admin | Full report + (soon) admin tools |

Survey respondents are unaffected: the survey uses anonymous sessions, and every results rule requires a real email account.

---

## One-time setup (about 20 minutes)

### Step 1 — Turn off email confirmation (for now)
Supabase's built-in email only delivers to your own team's addresses (max 2 per hour), so confirmation emails would never reach collaborators.

1. Open supabase.com → your **WatchTok 2026 Survey** project.
2. Left menu: **Authentication** → **Sign In / Providers** → **Email**.
3. Switch **Confirm email** **off**. Leave **Enable Email provider** on. Save.

> Before brands are invited at scale, set up a real email sender (e.g. Resend) under **Authentication → Emails → SMTP Settings**, then turn **Confirm email** back on. Until then, password resets are handled by email to watchtoksurvey@gmail.com.

### Step 2 — Install the access rules
1. Left menu: **SQL Editor** → **New query**.
2. Open `supabase/010_results_access.sql` from this repository, copy everything, paste it in, click **Run**.
3. You should see: `WatchTok results access control installed`. (It's safe to run again.)

### Step 3 — Create the collaborator passcode
In a **new query**, run (choose your own passcode — don't reuse this example):

```sql
select results_create_passcode('Founding team', 'YOUR-PASSCODE-HERE', 50);
```

- `'Founding team'` is a label you'll see in usage stats.
- `50` is how many people can use it. Use `null` for unlimited.
- Passcodes are stored scrambled; nobody (including you) can read them back later. Write it down.
- Capitalization and spaces don't matter when people type it.

To retire a passcode: `update results_passcodes set active = false where label = 'Founding team';`

### Step 4 — Upload the report content
1. Left menu: **Storage**. You'll see a bucket named **results-content** (created by Step 2, marked Private).
2. Open it and upload the two folders from `build/results-content/`: **sample** and **full** — keep the folder names exactly.
3. The bucket must stay **Private**. Never tick "Public bucket".

### Step 5 — Make yourself admin
1. Go to https://watchtoksurvey.com/results/ and create your own account (use the passcode).
2. In the SQL Editor run:

```sql
select results_set_tier('cris.bjelajac@gmail.com', 'admin');
```

---

## Everyday tasks

**See who has registered**
```sql
select email, full_name, organization, member_type, tier, created_at
from results_members order by created_at desc;
```

**Usage (who viewed what)**
```sql
select m.email, e.event, e.detail, e.created_at
from results_events e join results_members m using (user_id)
order by e.created_at desc limit 200;
```

**Give or remove full access by hand**
```sql
select results_set_tier('person@example.com', 'full');    -- or 'sample'
```
(This also unlocks someone who typed a wrong passcode 10 times.)

**Publish a new report version**
1. Save the latest report page and its `assets/` folder into one folder.
2. Run: `npm run build:results -- <that-folder> --version "Oct 10, 2026"`
3. In Storage → results-content, delete the old **sample** and **full** folders and upload the new ones.
4. If `results/report.css` or `results/report-lib.js` changed, commit them to GitHub too.

## What's in the repository
- `results/` — the sign-in page and viewer (no survey data).
- `supabase/010_results_access.sql` — accounts, tiers, passcodes, private bucket rules.
- `scripts/build-results-content.mjs` — splits the report into preview and full content.
- `build/` — generated content for upload; git-ignored, never committed.
