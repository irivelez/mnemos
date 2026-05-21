# mnemos — first run

Paste-ready commands from a clean clone to a working `feed search` query. Total wall time ~10 minutes, $0 except OpenAI embeddings (~$0.30/month at production volume).

## 0 · prerequisites

Have these ready before you start:
- A Supabase account (free tier is enough)
- Existing `BIRD_AUTH_TOKEN`, `BIRD_CT0`, `BRAVE_API_KEY` from `content-engine/.env`

Embeddings run locally via `@xenova/transformers` (no API key, ~25 MB model downloaded on first ingest). The GitHub repo already exists at https://github.com/irivelez/mnemos.

## 1 · provision supabase

```
1. https://supabase.com/dashboard → New project
2. Name: mnemos · Region: us-west (closest to you) · save the DB password
3. Wait ~90s for provisioning
4. Settings → API:
     Project URL              → SUPABASE_URL
     service_role secret key  → SUPABASE_SERVICE_ROLE_KEY
```

## 2 · configure .env

```sh
cd /Users/irina/AI-driven-OS/memory2
cp .env.example .env
```

Fill in `.env`:
```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role from step 1>
```

Lift the remaining three from existing content-engine:
```sh
grep -E '^(BIRD_|BRAVE_)' /Users/irina/AI-driven-OS/content-engine/.env >> .env
```

## 3 · run migrations

```sh
npm run db:migrate
```

This prints two SQL blocks. Open https://supabase.com/dashboard/project/_/sql/new , paste `0001_init.sql` block, click **Run**. Then do the same for `0002_search_fn.sql`. Both should report "Success. No rows returned."

## 4 · smoke-test the code

```sh
npm install
npm run typecheck    # must be silent
npm run smoke        # must report "28 passed · 0 failed"
```

## 5 · first ingest

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
  [embed] loading Xenova/all-MiniLM-L6-v2 (first run downloads ~25 MB)...
  [embed] 472 items embedded locally...

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

## 6 · query the brain

```sh
npm run feed -- search "claude code subagents" -n 10
npm run feed -- trending --hours 24
npm run feed -- trending -t trusted,enterprise --limit 15
npm run feed -- novel
npm run feed -- correlate "open weights"
npm run feed -- angles --limit 8
```

## 7 · daily cron (optional)

The cron workflow is staged at [`cron/ingest.yml.example`](./cron/ingest.yml.example). To activate it:

```sh
mkdir -p .github/workflows
cp cron/ingest.yml.example .github/workflows/ingest.yml
git add .github/workflows/ingest.yml
git commit -m "ops: enable daily ingest cron"
git push
```

If the push fails with `refusing to allow an OAuth App to create or update workflow`, your `gh` token lacks `workflow` scope. Fix:
- Open https://github.com/settings/tokens
- Edit the active token (or create a new classic token with `repo` + `workflow` scopes)
- Re-run the push

Then add these six repository secrets at `https://github.com/irivelez/mnemos/settings/secrets/actions`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BIRD_AUTH_TOKEN`
- `BIRD_CT0`
- `BRAVE_API_KEY`

The workflow runs daily at 15:00 UTC (8 AM PT) and pushes everything new to Supabase.

## troubleshooting

**`Missing required env var: SUPABASE_URL`** — your `.env` isn't being read. Check that `.env` is in the repo root (`/Users/irina/AI-driven-OS/memory2/.env`) and contains the variable.

**`[x] error "from:karpathy": ...`** — bird cookies expired. Refresh `BIRD_AUTH_TOKEN` + `BIRD_CT0` in `.env` and re-run.

**`extension "vector" does not exist`** — pgvector isn't enabled on your Supabase project. Open the Supabase dashboard → Database → Extensions, search "vector", enable.

**`[embed] batch failed: ...`** — first run downloads the MiniLM model (~25 MB). Needs internet on the first invocation. After that it's offline.

**`[reddit] r/X: HTTP 429`** — Brave Search rate limit. Free tier is 2000 queries/month. Will reset.

**Smoke test fails after install** — file an issue with the failing assertion name; likely a Node version mismatch (require Node 20+).
