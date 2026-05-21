import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../lib/env.js';
import type { RawItem } from '../lib/types.js';

const execFileP = promisify(execFile);

interface BirdTweet {
  id: string;
  text?: string;
  createdAt?: string;
  created_at?: string;
  timeParsed?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  author?: { username?: string };
}

export async function searchX(query: string, count = 10): Promise<RawItem[]> {
  const token = env.birdAuthToken();
  const ct0 = env.birdCt0();
  if (!token || !ct0) return [];

  try {
    const { stdout } = await execFileP(
      'bird',
      ['search', query, '--count', String(count), '--json', '--auth-token', token, '--ct0', ct0],
      { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 },
    );
    const tweets: BirdTweet[] = JSON.parse(stdout);
    return tweets.map((t) => {
      const likes = t.likeCount ?? 0;
      const retweets = t.retweetCount ?? 0;
      const replies = t.replyCount ?? 0;
      const username = t.author?.username ?? 'unknown';
      return {
        source: 'x' as const,
        title: (t.text ?? '').slice(0, 120),
        content: t.text ?? '',
        author: `@${username}`,
        url: username !== 'unknown' ? `https://x.com/${username}/status/${t.id}` : undefined,
        likes,
        comments: replies,
        retweets,
        views: t.viewCount ?? 0,
        engagementScore: likes + retweets * 3 + replies * 2,
        publishedAt: t.createdAt ?? t.created_at ?? t.timeParsed ?? null,
      } satisfies RawItem;
    });
  } catch (e) {
    console.error(`  [x] error "${query}":`, (e as Error).message);
    return [];
  }
}
