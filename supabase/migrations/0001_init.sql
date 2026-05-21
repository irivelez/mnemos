-- mnemos v0.1 schema
-- Postgres 15+ with pgvector. Run on a fresh Supabase project.

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────
-- articles: every item we ingest from any source
-- ─────────────────────────────────────────────────────────────
create table if not exists articles (
  id                uuid primary key default gen_random_uuid(),

  source            text not null,           -- 'x' | 'hn' | 'rss' | 'reddit' | 'search'
  source_name       text,                    -- 'Stratechery', 'r/ClaudeAI', '@karpathy'
  tier              text,                    -- 'trusted' | 'creator' | 'enterprise' | 'latam' | 'broad' | 'hackernews' | 'rss' | 'reddit'
  title             text not null,
  content           text,
  url               text,
  url_hash          text not null,           -- canonical-URL sha256 hex; dedupe key
  author            text,
  published_at      timestamptz,
  ingested_at       timestamptz not null default now(),

  likes             int default 0,
  comments          int default 0,
  retweets          int default 0,
  views             int default 0,
  engagement_score  real default 0,
  signal_weight     real default 1.0,
  hot               boolean default false,

  embedding         vector(1536),            -- text-embedding-3-small

  raw_json          jsonb
);

create unique index if not exists articles_url_hash_uniq on articles (url_hash);
create index if not exists articles_embedding_hnsw on articles using hnsw (embedding vector_cosine_ops);
create index if not exists articles_source_published on articles (source, published_at desc);
create index if not exists articles_tier_published on articles (tier, published_at desc);
create index if not exists articles_ingested on articles (ingested_at desc);
create index if not exists articles_title_trgm on articles using gin (title gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────
-- entities: people, companies, products, concepts mentioned
-- (populated in V1.1 by NER pass; schema reserved here.)
-- ─────────────────────────────────────────────────────────────
create table if not exists entities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  normalized    text not null unique,    -- lowercase, punctuation-stripped
  type          text not null,           -- 'person' | 'company' | 'product' | 'concept' | 'tech'
  aliases       text[] not null default '{}',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  mention_count int not null default 0
);

create index if not exists entities_type on entities (type);

create table if not exists entity_mentions (
  article_id  uuid not null references articles(id) on delete cascade,
  entity_id   uuid not null references entities(id) on delete cascade,
  context     text,
  primary key (article_id, entity_id)
);

create index if not exists entity_mentions_entity on entity_mentions (entity_id);

-- ─────────────────────────────────────────────────────────────
-- temporal_facts: Graphiti-style temporal edges.
-- Every fact carries the four lifecycle stamps from VCN #33 slide 30.
-- ─────────────────────────────────────────────────────────────
create table if not exists temporal_facts (
  id                  uuid primary key default gen_random_uuid(),
  subject_id          uuid not null references entities(id) on delete cascade,
  predicate           text not null,         -- 'works_at' | 'joined' | 'launched' | 'co_mentioned_with' | etc.
  object_id           uuid references entities(id) on delete cascade,
  object_text         text,                  -- when object is not an entity

  fact                text not null,         -- natural-language claim

  -- Graphiti's four timestamps
  created_at          timestamptz not null default now(),  -- row written
  valid_at            timestamptz,                         -- when fact became true in the world
  invalid_at          timestamptz,                         -- when fact stopped being true
  expired_at          timestamptz,                         -- when system noticed supersession

  confidence          real not null default 1.0,
  source_article_ids  uuid[] not null default '{}'
);

create index if not exists facts_subject on temporal_facts (subject_id, valid_at desc);
create index if not exists facts_predicate on temporal_facts (predicate);
create index if not exists facts_lifecycle on temporal_facts (valid_at, invalid_at);

-- ─────────────────────────────────────────────────────────────
-- ingest_runs: bookkeeping per fetch run
-- ─────────────────────────────────────────────────────────────
create table if not exists ingest_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',  -- 'running' | 'ok' | 'partial' | 'failed'
  raw_count    int default 0,
  deduped      int default 0,
  embedded     int default 0,
  errors       jsonb default '[]'
);

create index if not exists ingest_runs_started on ingest_runs (started_at desc);

-- ─────────────────────────────────────────────────────────────
-- angles_emitted: history of angles surfaced to the newsletter
-- so we never repeat the same angle twice.
-- ─────────────────────────────────────────────────────────────
create table if not exists angles_emitted (
  id                  uuid primary key default gen_random_uuid(),
  topic               text not null,
  angle               text not null,
  source_article_ids  uuid[] not null,
  emitted_at          timestamptz not null default now()
);

create index if not exists angles_emitted_at on angles_emitted (emitted_at desc);
create index if not exists angles_emitted_fts on angles_emitted using gin (to_tsvector('english', topic || ' ' || angle));
