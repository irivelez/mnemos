import { fetchAll, loadConfig } from '../fetchers/index.js';
import { canonicalizeUrl, urlHash } from '../lib/url.js';
import { embedTexts } from './embed.js';
import { existingHashes, insertArticles, toRow } from '../memory/articles.js';
import { finishRun, startRun } from '../memory/runs.js';
import type { RawItem } from '../lib/types.js';

export interface IngestSummary {
  raw: number;
  dedupedLocally: number;
  newOnly: number;
  embedded: number;
  inserted: number;
  byTier: Record<string, number>;
  bySource: Record<string, number>;
}

function dedupeLocal(items: RawItem[]): { item: RawItem; canonical: string | null; hash: string }[] {
  const seen = new Set<string>();
  const out: { item: RawItem; canonical: string | null; hash: string }[] = [];
  for (const item of items) {
    const canonical = canonicalizeUrl(item.url);
    const hash = urlHash(canonical, item.title);
    if (seen.has(hash)) continue;
    seen.add(hash);
    out.push({ item, canonical, hash });
  }
  return out;
}

function tierRank(t: string | null | undefined): number {
  const order: Record<string, number> = {
    trusted: 0, creator: 1, enterprise: 1, latam: 1,
    hackernews: 2, rss: 2, reddit: 3, broad: 4, 'content-broad': 4,
  };
  return order[t ?? ''] ?? 5;
}

export async function runIngest(opts: { dryRun?: boolean } = {}): Promise<IngestSummary> {
  const runId = opts.dryRun ? null : await startRun();
  try {
    const config = await loadConfig();
    console.log(`\nmnemos ingest — ${new Date().toISOString()}\n`);
    const raw = await fetchAll(config);

    const local = dedupeLocal(raw);
    local.sort((a, b) => {
      const ta = tierRank(a.item.tier);
      const tb = tierRank(b.item.tier);
      if (ta !== tb) return ta - tb;
      return (b.item.engagementScore ?? b.item.likes ?? 0) - (a.item.engagementScore ?? a.item.likes ?? 0);
    });

    const seenInDb = await existingHashes(local.map((x) => x.hash));
    const fresh = local.filter((x) => !seenInDb.has(x.hash));
    console.log(`  [dedupe] ${local.length} local-unique, ${fresh.length} new vs DB`);

    const texts = fresh.map(({ item }) =>
      [item.title, item.content].filter((x): x is string => Boolean(x)).join('\n').slice(0, 8000),
    );
    console.log(`  [embed] ${texts.length} items via text-embedding-3-small...`);
    const vectors = await embedTexts(texts);
    const embedded = vectors.filter((v) => v !== null).length;

    const rows = fresh.map(({ item, canonical, hash }, i) => {
      const row = toRow(item, canonical, hash);
      row.embedding = vectors[i] ?? null;
      return row;
    });

    let inserted = 0;
    if (!opts.dryRun && rows.length > 0) {
      const r = await insertArticles(rows);
      inserted = r.inserted;
    }

    const byTier: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const r of rows) {
      const t = r.tier ?? 'unknown';
      const s = r.source;
      byTier[t] = (byTier[t] ?? 0) + 1;
      bySource[s] = (bySource[s] ?? 0) + 1;
    }

    const summary: IngestSummary = {
      raw: raw.length,
      dedupedLocally: local.length,
      newOnly: fresh.length,
      embedded,
      inserted,
      byTier,
      bySource,
    };

    if (runId) {
      await finishRun(runId, {
        status: 'ok',
        raw_count: summary.raw,
        deduped: summary.newOnly,
        embedded: summary.embedded,
      });
    }
    return summary;
  } catch (e) {
    if (runId) {
      await finishRun(runId, { status: 'failed', errors: [{ message: (e as Error).message }] }).catch(() => {});
    }
    throw e;
  }
}
