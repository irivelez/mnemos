import { env } from '../lib/env.js';
import type { RawItem } from '../lib/types.js';

const TOPIC_MAP: Record<string, string> = {
  ClaudeAI: 'reddit ClaudeAI Claude Code AI agents',
  ClaudeCode: 'reddit ClaudeCode Claude Code coding agents',
  ChatGPT: 'reddit ChatGPT AI tools workflow',
  AI_Agents: 'reddit AI_Agents agents automation workflow',
  artificial: 'reddit artificial intelligence AI news',
};

function parsePageAge(str: string | undefined): number {
  if (!str) return 0;
  const m = str.match(/(\d+)\s*(hour|day|week|month)/i);
  if (!m) return 0;
  const n = parseInt(m[1]!, 10);
  const unit = (m[2] ?? 'day').toLowerCase();
  const ms: Record<string, number> = { hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 };
  return n * (ms[unit] ?? 86_400_000);
}

interface BraveResult {
  title?: string;
  description?: string;
  url?: string;
  page_age?: string;
}

export async function searchRedditViaBrave(subreddit: string, limit = 10): Promise<RawItem[]> {
  const key = env.braveApiKey();
  if (!key) {
    console.error(`  [reddit] no BRAVE_API_KEY, skipping r/${subreddit}`);
    return [];
  }
  try {
    const q = TOPIC_MAP[subreddit] ?? `reddit ${subreddit} AI`;
    const resp = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${limit}&freshness=pw`,
      {
        headers: { Accept: 'application/json', 'X-Subscription-Token': key },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!resp.ok) {
      console.error(`  [reddit] r/${subreddit}: HTTP ${resp.status}`);
      return [];
    }
    const data = (await resp.json()) as { web?: { results?: BraveResult[] } };
    return (data.web?.results ?? [])
      .filter((r) => r.url && r.url.includes('reddit.com/r/'))
      .map((r) => ({
        source: 'reddit' as const,
        tier: 'reddit' as const,
        title: (r.title ?? '').replace(/^r\/\w+ on Reddit:\s*/, '').replace(/ : r\/\w+$/, ''),
        content: r.description ?? r.title ?? '',
        author: `r/${subreddit}`,
        url: r.url,
        publishedAt: r.page_age
          ? new Date(Date.now() - parsePageAge(r.page_age)).toISOString()
          : new Date().toISOString(),
      } satisfies RawItem));
  } catch (e) {
    console.error(`  [reddit] r/${subreddit} error:`, (e as Error).message);
    return [];
  }
}
