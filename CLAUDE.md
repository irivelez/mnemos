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
└── .github/workflows/ingest.yml  daily cron
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

- **bird CLI cookies expire ~weekly.** When `[x] error` floods, refresh `BIRD_AUTH_TOKEN` and `BIRD_CT0` and re-run.
- **Embeddings are ~$0.30/mo** at current volume. Caps come from OpenAI rate limits, not cost.
- **Supabase free tier = 500 MB.** At 30k articles/mo × ~5 KB row + ~6 KB embedding, expect ~330 MB/mo. Add a retention sweep when it gets tight.
- **GitHub Actions free tier = 2000 min/mo private repo**, unlimited public. Daily cron uses ~10 min/run = ~300 min/mo. Fine either way.

## V1.1 work pending

- `src/ingest/entities.ts` — Claude Haiku NER, batched ~50 articles per call, populate `entities` + `entity_mentions`.
- `src/ingest/temporal.ts` — Detect supersession ("X joined Y" supersedes prior "works at Z") and set `invalid_at`.
- `src/retrieval/entities.ts` — `feed timeline <entity>`, `feed cooccur <entity>`.
- `web/` — Next.js 16 app, Supabase read-only, deploy to Vercel.

## Style for future PRs

- Smallest correct change. Don't refactor while fixing a bug.
- New fetchers must round-trip through `--dry-run` before merging.
- Migrations are append-only. Never edit a numbered file after it's been applied.
- Type-check on every change: `npm run typecheck`.
