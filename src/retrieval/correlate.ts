import { db } from '../memory/client.js';
import { embedTexts } from '../ingest/embed.js';

export interface CorrelationHit {
  title: string;
  url: string | null;
  source: string;
  source_name: string | null;
  tier: string | null;
  published_at: string | null;
  similarity: number;
}

export interface CrossSourceCluster {
  query: string;
  bySource: Record<string, CorrelationHit[]>;
  sourceCount: number;
}

export async function correlateAcrossSources(query: string, perSource = 3): Promise<CrossSourceCluster> {
  const [vec] = await embedTexts([query]);
  if (!vec) throw new Error('Failed to embed query');
  const { data, error } = await db().rpc('mnemos_search', {
    query_embedding: vec,
    match_count: 50,
  });
  if (error) throw error;
  const hits = (data ?? []) as CorrelationHit[];

  const bySource: Record<string, CorrelationHit[]> = {};
  for (const h of hits) {
    const k = h.source;
    if (!bySource[k]) bySource[k] = [];
    if (bySource[k]!.length < perSource) bySource[k]!.push(h);
  }
  return {
    query,
    bySource,
    sourceCount: Object.keys(bySource).length,
  };
}
