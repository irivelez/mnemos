export type SourceKind = 'x' | 'hn' | 'rss' | 'reddit' | 'search';

export type Tier =
  | 'trusted'
  | 'creator'
  | 'enterprise'
  | 'latam'
  | 'hackernews'
  | 'rss'
  | 'reddit'
  | 'broad'
  | 'content-broad';

export interface RawItem {
  source: SourceKind;
  sourceName?: string;
  tier?: Tier;
  title: string;
  content?: string;
  url?: string;
  author?: string;
  publishedAt?: string | null;
  likes?: number;
  comments?: number;
  retweets?: number;
  views?: number;
  engagementScore?: number;
  signalWeight?: number;
}

export interface DiscoveryConfig {
  trustedVoices: string[];
  contentCreators: string[];
  contentQueries: string[];
  queries: string[];
  subreddits: string[];
  rssFeeds: { name: string; url: string; signalWeight?: number; tier?: Tier; contrarian?: boolean }[];
  braveSourceOverrides: Record<string, { name?: string; signalWeight?: number; tier?: Tier }>;
  topicFilters: string[];
  hotThreshold: { likes: number; label: string; note?: string };
  maxResults?: number;
  broadSearchQualityFilter?: { minViews?: number; minLikes?: number; minFollowers?: number; bioKeywords?: string[] };
}
