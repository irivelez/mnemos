# mnemos

> Memory for content. Ingests X, Hacker News, RSS, Reddit, and search results. Stores them in Postgres with pgvector so you can semantically search, surface trends, and detect what's novel today versus the past week. Built to feed Irina's content engine with newsletter angles.

Named for [Mnemosyne](https://en.wikipedia.org/wiki/Mnemosyne), the goddess of memory and mother of the muses.

---

## What it does

```
GitHub Actions cron
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  fetchers/                                                  │
│   x.ts          bird CLI search by handle / query           │
│   hn.ts         HN Firebase API, AI-keyword filter          │
│   rss.ts        rss-parser, 17 feeds                        │
│   reddit.ts     Brave Search proxy, 5 subs                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  ingest/pipeline.ts                                         │
│   dedupe (URL canonicalize → sha256 → DB lookup)            │
│   embed  (OpenAI text-embedding-3-small, 1536-dim)          │
│   persist (Supabase upsert on url_hash)                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Postgres + pgvector                               │
│   articles            corpus + embeddings (HNSW)            │
│   entities            people/companies (V1.1)               │
│   temporal_facts      Graphiti-style 4-stamp edges (V1.1)   │
│   ingest_runs         bookkeeping                           │
│   angles_emitted      what was already published            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  retrieval/  +  CLI                                         │
│   feed search    semantic search                            │
│   feed trending  top-engagement, time-windowed              │
│   feed novel     today vs last 7d                           │
│   feed correlate same topic across sources                  │
│   feed angles    newsletter angle suggestions               │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup

→ **Paste-ready first-run guide: [FIRST_RUN.md](./FIRST_RUN.md)**

```sh
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY,
#         BIRD_AUTH_TOKEN, BIRD_CT0, BRAVE_API_KEY

# 3. Run the migration on your Supabase project
#    Open https://supabase.com/dashboard/project/_/sql/new
#    Paste the SQL from:
#      supabase/migrations/0001_init.sql
#      supabase/migrations/0002_search_fn.sql
#    Or:
npm run db:migrate          # prints the SQL to copy

# 4. Smoke test
npm run typecheck

# 5. Ingest
npm run ingest -- --dry-run   # fetch only, no DB write
npm run ingest                # full pipeline
```

---

## CLI

All commands print a summary to stdout. Run from the repo root.

```sh
npm run feed -- search "claude code subagents"     # semantic search
npm run feed -- trending --hours 24 --limit 20     # last 24h by engagement
npm run feed -- trending -t trusted,enterprise     # tier-filtered
npm run feed -- novel --limit 10                   # today vs last 7d
npm run feed -- correlate "open weights"           # same topic, all sources
npm run feed -- angles --limit 8                   # newsletter angle suggestions
```

For a global `feed` binary, add to `~/.zshrc`:

```sh
alias feed='npm --prefix /Users/irina/AI-driven-OS/mnemos run --silent feed --'
```

---

## Cost

Free tier across the board, except embeddings.

| Service | Tier | Cost |
|---|---|---|
| Supabase | Free (500 MB) | $0 |
| Vercel | Hobby (for future UI) | $0 |
| GitHub Actions | 2,000 min/mo free | $0 |
| OpenAI embeddings | `text-embedding-3-small` | ~$0.02 per 1M tokens |
| Brave Search | 2,000 queries/mo free | $0 |
| X via bird | Personal cookies | $0 |

At ~1,000 items/day × 500 tokens each ≈ **$0.30/month** for embeddings. Everything else is $0.

---

## Schema (workshop notes)

`articles.embedding` is the **vector layer** — fast semantic retrieval (HNSW index, sub-100ms over 30k rows).

`temporal_facts` is the **Graphiti-shaped layer**, reserved for V1.1. Every fact carries the four timestamps from [Rasmussen et al. arXiv:2501.13956](https://arxiv.org/abs/2501.13956):

| Stamp | Meaning |
|---|---|
| `created_at` | row written to the graph |
| `valid_at` | fact became true in the world |
| `invalid_at` | fact stopped being true (`null` = still live) |
| `expired_at` | system noticed the supersession |

The killer query from the [VCN #33 deck](https://vcn-33-total-recall.vercel.app) maps to:

```sql
select * from temporal_facts
where subject_id = :entity
  and valid_at <= now()
  and (invalid_at is null or invalid_at > now());
```

---

## Roadmap

**V1 — shipped** (this session)
- Fetchers for X, HN, RSS, Reddit
- Dedupe + embed + persist
- `search`, `trending`, `novel`, `correlate`, `angles`
- GitHub Actions cron
- Supabase migrations

**V1.1 — next session**
- Entity extraction (Claude Haiku NER, batched)
- Temporal-fact detection ("Karpathy joined Anthropic" supersedes "works at OpenAI")
- `feed entities` and `feed timeline` CLI commands
- Next.js web UI on Vercel

**V1.2**
- MCP server (use mnemos from Claude Code directly)
- Telegram alerts for hot signals
- LATAM-angle scoring model (Spanish output ready for content-engine)

---

## Why this exists

You had a fetcher that worked (`content-engine/scripts/fetch-sources.js`) and a data dump that worked (`the-feed`), but no brain in the middle. mnemos is the brain: it remembers what you've seen, knows what's new, and tells you which threads run across sources. Downstream, it feeds the content-engine's newsletter pipeline with concrete, citation-ready angles.

Lifts from existing repos:
- Fetchers: ported from `content-engine/scripts/fetch-sources.js`
- Discovery config: lifted as-is from `content-engine/input/discovery-config.json`
- RSS parser: `rss-parser` (matching Clawdbot's `src/tools/rss-reader.ts`)
- Tiering: trusted/creator/enterprise/latam/broad — kept exactly as content-engine ships
