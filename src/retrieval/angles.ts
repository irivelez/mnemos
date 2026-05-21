import { topByEngagement } from '../memory/articles.js';
import { novelOfToday } from './novelty.js';

export interface AngleCandidate {
  topic: string;
  hook: string;
  sourceTitles: string[];
  sourceUrls: string[];
  sourceMix: string[];
}

function topicOf(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .slice(0, 6)
    .join(' ');
}

export async function suggestAngles(limit = 8): Promise<AngleCandidate[]> {
  const [trending, novel] = await Promise.all([
    topByEngagement(48, ['trusted', 'creator', 'enterprise', 'latam'], 40),
    novelOfToday(20),
  ]);

  const groups = new Map<string, { titles: string[]; urls: string[]; sources: Set<string> }>();
  const push = (title: string, url: string | null, source: string) => {
    const t = topicOf(title);
    if (!t) return;
    if (!groups.has(t)) groups.set(t, { titles: [], urls: [], sources: new Set() });
    const g = groups.get(t)!;
    g.titles.push(title);
    if (url) g.urls.push(url);
    g.sources.add(source);
  };
  for (const h of trending) push(h.title, h.url, h.source);
  for (const h of novel) push(h.title, h.url, h.source);

  const ranked = [...groups.entries()]
    .map(([topic, g]) => ({
      topic,
      titles: g.titles,
      urls: [...new Set(g.urls)],
      sources: [...g.sources],
      score: g.sources.size * 3 + g.titles.length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map((r) => ({
    topic: r.topic,
    hook: r.titles[0] ?? r.topic,
    sourceTitles: r.titles.slice(0, 4),
    sourceUrls: r.urls.slice(0, 4),
    sourceMix: r.sources,
  }));
}
