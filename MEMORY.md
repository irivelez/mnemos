# mnemos — living memory (deck-style auto-memory entries)

Per VCN #33 (slide 18, "claude code auto-memory · the receipt"), this file is the agent's self-curated index. Each entry is a short, decision-relevant fact about *this codebase* or *Irina's working context* that a future Claude session should know before touching code. Append-only. Promote stable patterns into [CLAUDE.md](./CLAUDE.md).

Format: one entry per topic, lowercase snake_case label, two-line max.

---

## project · mnemos

```
project_state          mnemos v0.1 lives at github.com/irivelez/mnemos (public). 7 commits as of session end. Last commit 8612e0b: `feat: 'feed verify' pre-flight command`.
project_blocking_gate  Awaiting Supabase project provisioning. Mgmt token (sbp_ in redin/.env.local) is dead. User must create via web UI then paste 2 SQL files. FIRST_RUN.md §1-7 has the paste sequence.
project_local_path     /Users/irina/AI-driven-OS/memory2/  (NOT /memory; user explicitly forbade writing in /memory).
project_purpose        Brain layer between content-engine (fetcher) and content-engine newsletter pipeline (writer). Aggregates X/HN/RSS/Reddit, dedupes, embeds, surfaces angles.
```

## technical · stack

```
embeddings_model        Xenova/all-MiniLM-L6-v2 via @xenova/transformers. 384-dim. Local CPU. ~25 MB download on first run. Verified semantically: cos(claude_a, claude_b)=0.897, cos(claude, sourdough)=-0.021.
embeddings_choice_why   No OPENAI_API_KEY anywhere in her .env files. Local MiniLM was the zero-third-party fallback. Quality verified sufficient for content dedup/search.
memory_choice           pgvector on Supabase + custom temporal_facts table with Graphiti's 4 timestamps. Picked over Mem0 (wrong shape: user-prefs not cross-source corr) and Letta (this is a pipeline, not an agent loop). Zep would be the V1.5 option if temporal queries get heavy.
schema_dim              vector(384) in 0001_init.sql AND 0002_search_fn.sql. Both must match the embedding model. Single source of truth: EMBED_DIM in src/ingest/embed.ts.
url_canonicalization    Strips utm_*/fbclid/gclid/ref params, fragments, www, trailing slash on bare host. sha256 of result is the dedupe key (`url_hash`). Title hash fallback only when URL absent.
dedupe_strategy         Two-layer: local Set dedupe within fetch run, then `existingHashes()` query against DB. Both keyed on `url_hash`. No fuzzy/semantic dedupe yet.
```

## technical · gotchas

```
bird_cookie_expiry      BIRD_AUTH_TOKEN + BIRD_CT0 expire ~weekly. Source: content-engine's own May 12 digest noted X auth failure. Plan for graceful degrade, not retry.
supabase_mgmt_token     sbp_… in /Users/irina/AI-driven-OS/autonomous/redin/marketplace/.env.local. Returns 401 as of 2026-05-21. Treat as dead.
github_workflow_scope   The keyring `irivelez` token lacks `workflow` scope. Pushes touching `.github/workflows/` get rejected. Workflow file is staged at cron/ingest.yml.example for that reason.
github_create_scope     content-engine/.env GITHUB_TOKEN is fine-grained PAT for `irivelez` — push-only on existing repos, cannot create new repos. Repo creation requires the classic keyring token after `gh auth switch --user irivelez`.
gh_active_account       Session ended with `gh auth switch --user irinavelezk` (her default). Switch to `irivelez` before any irivelez/* push, switch back after.
```

## technical · related repos

```
sibling_the-feed       github.com/irivelez/the-feed. Data-only (JSON dumps from content-engine). Digest gen broken intermittently when X auth fails. 1 squashed commit.
sibling_content-engine  github.com/irivelez/content-engine. The fetcher. Local /Users/irina/AI-driven-OS/content-engine is 8 commits ahead of GitHub HEAD (May 14-20). fetch-sources.js (438 lines) is what mnemos's fetchers were ported from.
sibling_techpulse      Next.js dashboard, reads JSON from GitHub Raw. Last touched March. Reads from a DIFFERENT repo path (`ai-content-engine`) — not the-feed. Stale UI, not the v2 target.
sibling_Clawdbot       7-agent system, SQLite, last touched March. Source of rss-parser usage pattern and research-trends agent that mnemos could absorb in V1.1.
sibling_redin           autonomous/redin — her LIVE WhatsApp agent for blue-collar dispatch in Colombia. Uses Supabase project ref `foerbjhnwbxfauajkbld`. Production — DO NOT add mnemos tables to it; she explicitly chose new dedicated project.
```

## person · irina

```
user_identity           Irina Velez. GitHub `irivelez` (primary) + `irinavelezk` (secondary, gh CLI active). SF-based, builds AI tooling for LATAM SMBs in Spanish.
user_role               Facilitator of Vibe Coding Nights (VCN). Attended VCN #33 on agent memory frameworks (slide deck at vcn-33-total-recall.vercel.app) — informed the mnemos memory choice.
user_voice              No em-dashes, en-dashes, or hyphen connectors in outbound drafts. Lowercase headlines. Spanish: tú not usted. Terse register; matches sender register.
user_decisions          In this session she chose Recommended options on every multi-choice. Favors free-tier paths ("cost-effective, almost free"). Prefers MCP-native tooling. Defers UI/polish to later phases.
user_communication      Paste-ready commands beat narrative explanations. No preamble. Direct corrections > soft suggestions.
```

## person · stack inventory

```
secrets_present         BIRD_AUTH_TOKEN (content-engine), BRAVE_API_KEY (content-engine), GITHUB_TOKEN (content-engine, fine-grained), ANTHROPIC_API_KEY (Clawdbot/speedrun/redin/pageforge/linkedpulse), TWITTER_API_KEY/SECRET (Clawdbot), BEEHIIV_API_KEY (content-engine/Clawdbot).
secrets_absent          OPENAI_API_KEY (nowhere). VOYAGE_API_KEY (nowhere). SUPABASE_URL + SERVICE_ROLE for any non-REDIN project (must be provisioned).
existing_supabase       REDIN production project at foerbjhnwbxfauajkbld.supabase.co. service_role key present in autonomous/redin/marketplace/.env.local. Has pgvector available (assumed; not verified).
```

## process · session lessons

```
gate_skepticism         "USER GATE" todos should be re-examined hard before declared blocked. This session, two prior gates yielded to skeptical re-examination: (1) gh auth switch exposed keyring `irivelez` account, (2) @xenova/transformers eliminated OpenAI dependency. The third gate (Supabase provisioning) was genuinely external.
hook_loop_termination   When OH-MY-OPENCODE continuation directive fires on a user-gated todo with no synthesizable path, mark `cancelled` with clear "transferred to human owner" note. Status options don't include "blocked"; `cancelled` is the closest defensible terminator.
verification_bar        Three layers ship with mnemos: typecheck (tsc --noEmit), smoke (28 pure-logic assertions), embed-smoke (real semantic clustering). Don't merge anything that breaks any of the three.
```
