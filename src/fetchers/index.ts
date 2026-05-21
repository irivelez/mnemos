import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep, isRecent, formatAge } from '../lib/util.js';
import { MAX_AGE_DAYS } from '../lib/env.js';
import type { DiscoveryConfig, RawItem } from '../lib/types.js';
import { searchX } from './x.js';
import { fetchHN } from './hn.js';
import { fetchRss } from './rss.js';
import { searchRedditViaBrave } from './reddit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', '..', 'config', 'discovery.json');

export async function loadConfig(): Promise<DiscoveryConfig> {
  const raw = await readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

export async function fetchAll(config: DiscoveryConfig): Promise<RawItem[]> {
  const results: RawItem[] = [];
  const trusted = new Set(config.trustedVoices.map((h) => h.toLowerCase()));
  const creators = new Set(config.contentCreators.map((h) => h.toLowerCase()));

  console.log(`  [x] trusted voices (${config.trustedVoices.length})...`);
  for (const handle of config.trustedVoices) {
    const tweets = await searchX(`from:${handle}`, 10);
    results.push(...tweets.map((t) => ({ ...t, tier: 'trusted' as const })));
    await sleep(600);
  }

  console.log(`  [x] content creators (${config.contentCreators.length})...`);
  for (const handle of config.contentCreators) {
    const tweets = await searchX(`from:${handle}`, 10);
    results.push(...tweets.map((t) => ({ ...t, tier: 'creator' as const })));
    await sleep(600);
  }

  console.log(`  [x] broad queries (${config.queries.length})...`);
  for (const query of config.queries) {
    const tweets = await searchX(query, 15);
    const filtered = tweets.filter((t) => {
      const h = (t.author ?? '').replace('@', '').toLowerCase();
      if (trusted.has(h)) return true;
      if ((t.likes ?? 0) < 100) return false;
      const text = (t.content ?? t.title ?? '').replace(/https?:\/\/\S+/g, '').trim();
      return text.length >= 60;
    });
    results.push(
      ...filtered.map((t) => {
        const h = (t.author ?? '').replace('@', '').toLowerCase();
        return { ...t, tier: trusted.has(h) ? ('trusted' as const) : ('broad' as const) };
      }),
    );
    await sleep(800);
  }

  console.log(`  [x] content queries (${config.contentQueries.length})...`);
  for (const query of config.contentQueries) {
    const tweets = await searchX(query, 15);
    const filtered = tweets.filter((t) => {
      const h = (t.author ?? '').replace('@', '').toLowerCase();
      if (trusted.has(h) || creators.has(h)) return true;
      if ((t.likes ?? 0) < 200) return false;
      const text = (t.content ?? t.title ?? '').replace(/https?:\/\/\S+/g, '').trim();
      return text.length >= 80;
    });
    results.push(
      ...filtered.map((t) => {
        const h = (t.author ?? '').replace('@', '').toLowerCase();
        const tier = creators.has(h) ? 'creator' : trusted.has(h) ? 'trusted' : 'content-broad';
        return { ...t, tier: tier as RawItem['tier'] };
      }),
    );
    await sleep(800);
  }

  console.log('  [hn] top stories...');
  results.push(...(await fetchHN(20)));

  console.log(`  [rss] feeds (${config.rssFeeds.length})...`);
  for (const feed of config.rssFeeds) {
    const items = await fetchRss(feed.url, feed.name, feed.tier ?? 'rss', feed.signalWeight ?? 1.0);
    results.push(...items);
    await sleep(300);
  }

  console.log(`  [reddit] subs (${config.subreddits.length})...`);
  for (const sub of config.subreddits) {
    const items = await searchRedditViaBrave(sub);
    results.push(...items);
    await sleep(1000);
  }

  const overrides = config.braveSourceOverrides ?? {};
  for (const item of results) {
    if (!item.tier || item.tier === 'broad') {
      for (const [domain, meta] of Object.entries(overrides)) {
        if (item.url?.includes(domain)) {
          item.tier = meta.tier ?? 'enterprise';
          item.signalWeight = meta.signalWeight ?? 1.0;
          item.sourceName = meta.name ?? item.sourceName;
          break;
        }
      }
    }
  }

  const recent = results.filter((item) => isRecent(item.publishedAt, MAX_AGE_DAYS));
  console.log(`  [filter] ${recent.length} recent / ${results.length} total (last ${MAX_AGE_DAYS}d)`);
  for (const item of recent) {
    (item as RawItem & { age?: string | null }).age = formatAge(item.publishedAt);
  }
  return recent;
}
