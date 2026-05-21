create or replace function mnemos_search(query_embedding vector(384), match_count int default 10)
returns table (
  id uuid,
  title text,
  url text,
  source text,
  source_name text,
  tier text,
  author text,
  published_at timestamptz,
  engagement_score real,
  similarity float
)
language sql stable as $$
  select
    a.id, a.title, a.url, a.source, a.source_name, a.tier, a.author,
    a.published_at, a.engagement_score,
    1 - (a.embedding <=> query_embedding) as similarity
  from articles a
  where a.embedding is not null
  order by a.embedding <=> query_embedding
  limit match_count;
$$;
