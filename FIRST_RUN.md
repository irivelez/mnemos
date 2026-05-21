# mnemos — first run

Paste-ready commands from a clean clone to a working `feed search` query. Total wall time ~10 minutes, $0 except OpenAI embeddings (~$0.30/month at production volume).

## 0 · prerequisites

Have these ready before you start:
- A GitHub account with permission to create `irivelez/mnemos`
- A Supabase account (free tier is enough)
- An OpenAI API key (https://platform.openai.com/api-keys)
- Existing `BIRD_AUTH_TOKEN`, `BIRD_CT0`, `BRAVE_API_KEY` from `content-engine/.env`

## 1 · push to github

Create the empty repo via web (CLI auth scope blocks this for now):

1. Open https://github.com/new
2. Owner: `irivelez` · Name: `mnemos` · Public · do NOT init with README

Then push from local:

```sh
cd /Users/irina/AI-driven-OS/memory2
git push -u origin main
```

(The remote `origin = https://github.com/irivelez/mnemos.git` is already configured.)

## 2 · provision supabase

```
1. https://supabase.com/dashboard → New project
2. Name: mnemos · Region: us-west (closest to you) · save the DB password
3. Wait ~90s for provisioning
4. Settings → API:
     Project URL              → SUPABASE_URL
     service_role secret key  → SUPABASE_SERVICE_ROLE_KEY
```

## 3 · configure .env

```sh
cd /Users/irina/AI-driven-OS/memory2
cp .env.example .env
```

Fill in `.env`:
```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role from step 2>
OPENAI_API_KEY=<your openai key>
```

Lift the remaining three from existing content-engine:
```sh
grep -E '^(BIRD_|BRAVE_)' /Users/irina/AI-driven-OS/content-engine/.env >> .env
```

## 4 · run migrations

```sh
npm run db:migrate
```

This prints two SQL blocks. Open https://supabase.com/dashboard/project/_/sql/new , paste `0001_init.sql` block, click **Run**. Then do the same for `0002_search_fn.sql`. Both should report "Success. No rows returned."

## 5 · smoke-test the code

```sh
npm install
npm run typecheck    # must be silent
npm run smoke        # must report "28 passed · 0 failed"
```

## 6 · first ingest

Dry run validates fetchers without touching the DB:

```sh
npm run ingest -- --dry-run
```

Then the real thing:

```sh
npm run ingest
```

Expected output (terminal):
```
mnemos ingest — 2026-05-21T03:14:00.000Z

  [x] trusted voices (31)...
  [x] content creators (17)...
  [x] broad queries (18)...
  [x] content queries (10)...
  [hn] top stories...
  [rss] feeds (17)...
  [reddit] subs (5)...
  [filter] 487 recent / 612 total (last 3d)
  [dedupe] 472 local-unique, 472 new vs DB
  [embed] 472 items via text-embedding-3-small...

──────── ingest summary ────────
{
  "raw": 612,
  "dedupedLocally": 472,
  "newOnly": 472,
  "embedded": 472,
  "inserted": 472,
  "byTier": { "trusted": 203, "creator": 123, "enterprise": 14, ... },
  "bySource": { "x": 415, "hn": 19, "rss": 54, "reddit": 34 }
}
```

## 7 · query the brain

```sh
npm run feed -- search "claude code subagents" -n 10
npm run feed -- trending --hours 24
npm run feed -- trending -t trusted,enterprise --limit 15
npm run feed -- novel
npm run feed -- correlate "open weights"
npm run feed -- angles --limit 8
```

## 8 · daily cron (optional)

In `https://github.com/irivelez/mnemos/settings/secrets/actions` add these six repository secrets (same values as `.env`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `BIRD_AUTH_TOKEN`
- `BIRD_CT0`
- `BRAVE_API_KEY`

The workflow at `.github/workflows/ingest.yml` runs daily at 15:00 UTC (8 AM PT) and pushes everything new to Supabase.

## troubleshooting

**`Missing required env var: SUPABASE_URL`** — your `.env` isn't being read. Check that `.env` is in the repo root (`/Users/irina/AI-driven-OS/memory2/.env`) and contains the variable.

**`[x] error "from:karpathy": ...`** — bird cookies expired. Refresh `BIRD_AUTH_TOKEN` + `BIRD_CT0` in `.env` and re-run.

**`extension "vector" does not exist`** — pgvector isn't enabled on your Supabase project. Open the Supabase dashboard → Database → Extensions, search "vector", enable.

**`[embed] batch failed: 401`** — OpenAI key wrong or out of credit.

**`[reddit] r/X: HTTP 429`** — Brave Search rate limit. Free tier is 2000 queries/month. Will reset.

**Smoke test fails after install** — file an issue with the failing assertion name; likely a Node version mismatch (require Node 20+).
