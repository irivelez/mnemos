import type { RawItem } from '../lib/types.js';

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'anthropic', 'openai', 'machine learning',
  'neural', 'transformer', 'agent', 'copilot', 'coding assistant', 'chatbot',
  'gemini', 'diffusion', 'prompt', 'fine-tun', 'rag', 'vector', 'embedding',
  'automation', 'deepseek', 'multi-agent', 'agentic',
];

interface HnItem {
  title?: string;
  text?: string;
  url?: string;
  by?: string;
  score?: number;
  descendants?: number;
  time?: number;
}

export async function fetchHN(limit = 20): Promise<RawItem[]> {
  try {
    const topIds = (await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.json())) as number[];

    const stories: RawItem[] = [];
    for (const id of topIds.slice(0, 60)) {
      try {
        const item = (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          signal: AbortSignal.timeout(5_000),
        }).then((r) => r.json())) as HnItem;
        if (!item?.title) continue;
        const lc = item.title.toLowerCase();
        if (!AI_KEYWORDS.some((kw) => lc.includes(kw))) continue;
        if ((item.score ?? 0) < 30) continue;
        const score = item.score ?? 0;
        const comments = item.descendants ?? 0;
        stories.push({
          source: 'hn',
          tier: 'hackernews',
          title: item.title,
          content: item.title + (item.text ? '\n' + item.text : ''),
          author: item.by ?? 'unknown',
          url: item.url ?? `https://news.ycombinator.com/item?id=${id}`,
          likes: score,
          comments,
          engagementScore: score + comments * 2,
          publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
        });
        if (stories.length >= limit) break;
      } catch {
        continue;
      }
    }
    return stories;
  } catch (e) {
    console.error('  [hn] error:', (e as Error).message);
    return [];
  }
}
