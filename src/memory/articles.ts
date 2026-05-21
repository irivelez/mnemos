import { db } from './client.js';
import type { RawItem, Tier } from '../lib/types.js';

export interface ArticleRow {
  id?: string;
  source: string;
  source_name: string | null;
  tier: string | null;
  title: string;
  content: string | null;
  url: string | null;
  url_hash: string;
  author: string | null;
  published_at: string | null;
  likes: number;
  comments: number;
  retweets: number;
  views: number;
  engagement_score: number;
  signal_weight: number;
  hot: boolean;
  embedding: number[] | null;
  raw_json: unknown;
}

export function toRow(item: RawItem, canonicalUrl: string | null, hash: string): ArticleRow {
  const likes = item.likes ?? 0;
  return {
    source: item.source,
    source_name: item.sourceName ?? null,
    tier: (item.tier as Tier) ?? null,
    title: item.title,
    content: item.content ?? null,
    url: canonicalUrl,
    url_hash: hash,
    author: item.author ?? null,
    published_at: item.publishedAt ?? null,
    likes,
    comments: item.comments ?? 0,
    retweets: item.retweets ?? 0,
    views: item.views ?? 0,
    engagement_score: item.engagementScore ?? 0,
    signal_weight: item.signalWeight ?? 1.0,
    hot: likes >= 10_000,
    embedding: null,
    raw_json: item,
  };
}

export async function existingHashes(hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const { data, error } = await db()
    .from('articles')
    .select('url_hash')
    .in('url_hash', hashes);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.url_hash));
}

export async function insertArticles(rows: ArticleRow[]): Promise<{ inserted: number }> {
  if (rows.length === 0) return { inserted: 0 };
  const { error, count } = await db()
    .from('articles')
    .upsert(rows, { onConflict: 'url_hash', ignoreDuplicates: true, count: 'exact' });
  if (error) throw error;
  return { inserted: count ?? rows.length };
}

export interface SearchHit {
  id: string;
  title: string;
  url: string | null;
  source: string;
  source_name: string | null;
  tier: string | null;
  author: string | null;
  published_at: string | null;
  engagement_score: number;
  similarity: number;
}

export async function semanticSearch(embedding: number[], limit = 10): Promise<SearchHit[]> {
  const { data, error } = await db().rpc('mnemos_search', {
    query_embedding: embedding,
    match_count: limit,
  });
  if (error) {
    if (error.code === '42883' || error.message.includes('mnemos_search')) {
      return semanticSearchFallback(embedding, limit);
    }
    throw error;
  }
  return data ?? [];
}

async function semanticSearchFallback(embedding: number[], limit: number): Promise<SearchHit[]> {
  const vec = `[${embedding.join(',')}]`;
  const { data, error } = await db()
    .from('articles')
    .select('id,title,url,source,source_name,tier,author,published_at,engagement_score,embedding')
    .not('embedding', 'is', null)
    .order('embedding', { ascending: true, foreignTable: undefined as never })
    .limit(limit * 4);
  if (error) throw error;
  if (!data) return [];
  const hits = data
    .map((row) => {
      const r = row as Record<string, unknown>;
      const emb = r.embedding;
      const v = Array.isArray(emb) ? (emb as number[]) : typeof emb === 'string' ? (JSON.parse(emb) as number[]) : null;
      if (!v) return null;
      const sim = cosineSim(embedding, v);
      const hit: SearchHit = {
        id: r.id as string,
        title: r.title as string,
        url: (r.url as string | null) ?? null,
        source: r.source as string,
        source_name: (r.source_name as string | null) ?? null,
        tier: (r.tier as string | null) ?? null,
        author: (r.author as string | null) ?? null,
        published_at: (r.published_at as string | null) ?? null,
        engagement_score: (r.engagement_score as number) ?? 0,
        similarity: sim,
      };
      return hit;
    })
    .filter((x): x is SearchHit => x !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  void vec;
  return hits;
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

export interface TrendingHit {
  source_name: string | null;
  author: string | null;
  title: string;
  url: string | null;
  tier: string | null;
  source: string;
  published_at: string | null;
  engagement_score: number;
}

export async function topByEngagement(hours: number, tierFilter?: string[], limit = 25): Promise<TrendingHit[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  let q = db()
    .from('articles')
    .select('source_name,author,title,url,tier,source,published_at,engagement_score')
    .gte('published_at', since)
    .order('engagement_score', { ascending: false })
    .limit(limit);
  if (tierFilter && tierFilter.length > 0) q = q.in('tier', tierFilter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TrendingHit[];
}
