import Parser from 'rss-parser';
import type { RawItem, Tier } from '../lib/types.js';

const parser = new Parser({
  timeout: 15_000,
  headers: { 'User-Agent': 'mnemos/0.1 (+https://github.com/irivelez/mnemos)' },
});

export async function fetchRss(
  url: string,
  sourceName: string,
  tier: Tier = 'rss',
  signalWeight = 1.0,
): Promise<RawItem[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).slice(0, 15).map((item) => ({
      source: 'rss' as const,
      sourceName,
      tier,
      title: (item.title ?? 'Untitled').trim(),
      content: (item.contentSnippet ?? item.content ?? '').slice(0, 1500),
      author: sourceName,
      url: item.link ?? undefined,
      publishedAt: item.isoDate ?? item.pubDate ?? null,
      signalWeight,
    }));
  } catch (e) {
    console.error(`  [rss] error ${sourceName}:`, (e as Error).message);
    return [];
  }
}
