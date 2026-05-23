# mnemos — agent procedural memory

Project root for `mnemos`. Read this before editing anything.

## What this repo is

A content-ingest + memory + retrieval system that pulls from X, Hacker News, RSS, Reddit, and search; stores everything in Supabase Postgres with pgvector; and answers semantic / trending / novelty / cross-source / angle queries from a CLI. Downstream consumer is Irina's content-engine newsletter pipeline.

## What this repo is NOT

- Not an agent loop. There is no Claude-driven decision tree on the hot path. Agents (Claude Haiku NER, angle synthesis) are *batch* helpers, not runtime gateways.
- Not a UI project. The web UI is V1.1 and lives under `web/` (when built).
- Not a content-engine replacement. mnemos *feeds* content-engine; content-engine still owns the writing pipeline.

## Layout

```
mnemos/
├── src/
│   ├── fetchers/       one file per source; each exports a pure fn returning RawItem[]
│   ├── ingest/         dedupe → embed → persist
│   ├── memory/         Supabase client + table CRUD
│   ├── retrieval/      search · trending · novelty · correlate · angles
│   ├── cli/            commander.js entry
│   └── lib/            shared types, env, utils, url canonicalization
├── supabase/migrations/   numbered .sql files; run in order on Supabase
├── config/discovery.json  trusted voices · creators · queries · RSS · subreddits
├── scripts/migrate.ts     prints migrations for paste-into-SQL-editor
├── scripts/smoke.ts       28 pure-logic assertions; `npm run smoke`
├── scripts/embed-smoke.ts proves local embeddings semantically meaningful
└── cron/ingest.yml.example  daily cron, staged here (token needs workflow scope to install at .github/workflows/)
```

## Conventions

- **TypeScript strict mode**, `noUncheckedIndexedAccess` on. Array access yields `T | undefined` — handle it.
- **No `any`**, no `@ts-ignore`. Prefer narrow types and `satisfies`.
- **ESM imports** with `.js` extensions even though sources are `.ts` (matches `moduleResolution: bundler` + `tsx`).
- **No comments** except where necessary: SQL schemas, regex, security, or non-obvious algorithms. Code should be self-documenting.
- **One source per file** in `fetchers/`. Each exports a pure async function returning `RawItem[]`. No DB access in fetchers.
- **Pipeline is the only writer.** `ingest/pipeline.ts` is the only file that calls `insertArticles`. Other code reads.
- **Dedupe key is `url_hash`.** Compute via `canonicalizeUrl` + sha256. Title fallback only when URL is absent.

## Adding a source

1. Create `src/fetchers/<name>.ts`. Export an async fn returning `RawItem[]`.
2. Add the source kind to `SourceKind` in `src/lib/types.ts`.
3. Wire the fn into `src/fetchers/index.ts → fetchAll`.
4. Add config entries to `config/discovery.json` if needed.
5. The pipeline will dedupe, embed, and persist with no further changes.

## Running locally

```sh
npm install
cp .env.example .env   # fill in
npm run db:migrate     # prints SQL to paste into Supabase SQL editor
npm run ingest -- --dry-run
npm run ingest
npm run feed -- search "claude code subagents"
```

## Operational notes

- **bird CLI cookies expire ~weekly.** When `[x] error` floods, refresh `BIRD_AUTH_TOKEN` and `BIRD_CT0` from `content-engine/.env` and re-run.
- **Embeddings cost $0.** Local `Xenova/all-MiniLM-L6-v2` via `@xenova/transformers`. Model downloads ~25 MB on first ingest, cached to `~/.cache/transformers/`. ~50 ms/item on CPU. Vector dim = **384** (not 1536). Schema must match — if you ever swap models, change `vector(384)` in both migrations.
- **Supabase free tier = 500 MB.** At 30k articles/mo × ~5 KB row + ~1.6 KB embedding (384×4 bytes), expect ~200 MB/mo. Add a retention sweep when it gets tight.
- **GitHub Actions** free tier = 2000 min/mo private, unlimited public. mnemos is public, so the daily cron is unbounded.
- **bird CLI** is content-engine's existing X scraper, not a public npm package — the cron workflow installs `bird-cli` globally; verify availability on Actions runner during first cron run.

## V1.1 work pending

- `src/ingest/entities.ts` — Claude Haiku NER, batched ~50 articles per call, populate `entities` + `entity_mentions`. Use her `ANTHROPIC_API_KEY` from any of `Clawdbot/.env`, `accelerator/speedrun/.env`, `autonomous/redin/marketplace/.env.local`, or `hack/pageforge/.env.local`.
- `src/ingest/temporal.ts` — Detect supersession ("X joined Y" supersedes prior "works at Z") and set `invalid_at`. This is the Graphiti slide-30 logic from VCN #33 the schema was designed for.
- `src/retrieval/entities.ts` — `feed timeline <entity>`, `feed cooccur <entity>`.
- `web/` — Next.js 16 app, Supabase read-only, deploy to Vercel.

## Style for future PRs

- **Smallest correct change.** Don't refactor while fixing a bug.
- **New fetchers must round-trip through `--dry-run`** before merging.
- **Migrations are append-only.** Never edit a numbered file after it's been applied.
- **Type-check on every change**: `npm run typecheck`.
- **SQL comments are necessary** for `text`-typed columns that have an implicit enum (e.g. `source`, `tier`); we deliberately chose `text` over Postgres enums for schema evolution flexibility, so comments are the only place valid values live.
- **One CLAUDE.md fact per finding.** Append to MEMORY.md for living per-session notes; promote stable patterns into this file.

## Auth quirks Claude will hit

- **`gh` CLI**: keyring has TWO accounts (`irivelez` + `irinavelezk`). The active account when this session ended is `irinavelezk`. To push to `irivelez/*` repos, use `gh auth switch --user irivelez` first, then push, then switch back.
- **`irivelez` keyring token** is classic with `gist, read:org, repo`. **Lacks `workflow` scope** — pushes that touch `.github/workflows/*` fail with `refusing to allow an OAuth App to create or update workflow`. Workaround: stage workflow files at `cron/ingest.yml.example` and document the activation copy step.
- **`GITHUB_TOKEN` in content-engine/.env** is `irivelez`'s fine-grained PAT, repo-scoped — works for pushes to existing repos but **cannot create new repos**.
- **`SUPABASE_MANAGEMENT_TOKEN` in `autonomous/redin/marketplace/.env.local`** returns 401 as of this session. Treat as dead unless she refreshes it at https://supabase.com/dashboard/account/tokens.
