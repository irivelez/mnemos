import { topByEngagement, type TrendingHit } from '../memory/articles.js';

export async function trending(opts: { hours?: number; tiers?: string[]; limit?: number } = {}): Promise<TrendingHit[]> {
  return topByEngagement(opts.hours ?? 24, opts.tiers, opts.limit ?? 25);
}
