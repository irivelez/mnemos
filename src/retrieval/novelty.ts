import { db } from '../memory/client.js';

export interface NoveltyHit {
  id: string;
  title: string;
  url: string | null;
  source: string;
  tier: string | null;
  published_at: string | null;
  novelty_score: number;
}

export async function novelOfToday(limit = 15): Promise<NoveltyHit[]> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const baselineSince = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: candidates, error: cErr } = await db()
    .from('articles')
    .select('id,title,url,source,tier,published_at,embedding')
    .gte('ingested_at', since)
    .not('embedding', 'is', null)
    .order('engagement_score', { ascending: false })
    .limit(120);
  if (cErr) throw cErr;
  if (!candidates) return [];

  const out: NoveltyHit[] = [];
  for (const c of candidates) {
    const emb = (c as { embedding?: number[] | string }).embedding;
    const v = Array.isArray(emb) ? emb : typeof emb === 'string' ? JSON.parse(emb) : null;
    if (!v) continue;
    const { data: neighbors, error: nErr } = await db().rpc('mnemos_search', {
      query_embedding: v,
      match_count: 5,
    });
    if (nErr) continue;
    const olderTop = (neighbors ?? [])
      .filter((n: { id: string; published_at: string | null }) =>
        n.id !== c.id && (n.published_at ?? '') < baselineSince,
      )
      .slice(0, 1);
    const topSim = olderTop[0]?.similarity ?? 0;
    const novelty = 1 - topSim;
    out.push({
      id: c.id,
      title: c.title,
      url: c.url,
      source: c.source,
      tier: c.tier,
      published_at: c.published_at,
      novelty_score: novelty,
    });
  }
  return out.sort((a, b) => b.novelty_score - a.novelty_score).slice(0, limit);
}
