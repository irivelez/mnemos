import { canonicalizeUrl, urlHash } from '../src/lib/url.js';
import { formatAge, isRecent, chunk } from '../src/lib/util.js';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function eq<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ok  · ${label}`);
  } else {
    failed++;
    failures.push(`${label}\n      actual:   ${a}\n      expected: ${e}`);
    console.log(`  FAIL· ${label}`);
  }
}

function truthy(label: string, actual: unknown): void {
  if (actual) {
    passed++;
    console.log(`  ok  · ${label}`);
  } else {
    failed++;
    failures.push(`${label} (got falsy)`);
    console.log(`  FAIL· ${label}`);
  }
}

console.log('\n── url.canonicalizeUrl ────────────────────');
eq('null in → null out', canonicalizeUrl(null), null);
eq('empty in → null out', canonicalizeUrl(''), null);
eq('strips www', canonicalizeUrl('http://www.example.com/'), 'https://example.com');
eq('forces https', canonicalizeUrl('http://example.com/path'), 'https://example.com/path');
eq('strips trailing slash', canonicalizeUrl('https://example.com/blog/'), 'https://example.com/blog');
eq(
  'strips utm params',
  canonicalizeUrl('https://example.com/x?utm_source=twitter&id=42'),
  'https://example.com/x?id=42',
);
eq('strips fragment', canonicalizeUrl('https://example.com/x#hash'), 'https://example.com/x');
eq(
  'handles X tweet url',
  canonicalizeUrl('https://x.com/karpathy/status/1234567890?s=20'),
  'https://x.com/karpathy/status/1234567890',
);
eq(
  'leaves unknown query params',
  canonicalizeUrl('https://example.com/x?id=42&page=2'),
  'https://example.com/x?id=42&page=2',
);
eq('case-folds host', canonicalizeUrl('https://EXAMPLE.com/x'), 'https://example.com/x');

console.log('\n── url.urlHash ────────────────────────────');
const h1 = urlHash('https://example.com/x', 'A title');
const h2 = urlHash('https://example.com/x', 'B different title');
eq('same URL → same hash regardless of title', h1, h2);
const h3 = urlHash(null, 'Same title');
const h4 = urlHash(null, 'Same title');
eq('null URL + same title → same hash', h3, h4);
const h5 = urlHash(null, 'Title one');
const h6 = urlHash(null, 'Title two');
truthy('null URL + different title → different hash', h5 !== h6);
truthy('hash is 64 hex chars', /^[a-f0-9]{64}$/.test(h1));

console.log('\n── util.formatAge ─────────────────────────');
eq('null → null', formatAge(null), null);
const recentIso = new Date(Date.now() - 2 * 3_600_000).toISOString();
eq('2h ago → "2h"', formatAge(recentIso), '2h');
const dayIso = new Date(Date.now() - 3 * 86_400_000).toISOString();
eq('3d ago → "3d"', formatAge(dayIso), '3d');
const futureIso = new Date(Date.now() + 3600_000).toISOString();
eq('future → "0h"', formatAge(futureIso), '0h');

console.log('\n── util.isRecent ──────────────────────────');
eq('null → false', isRecent(null, 3), false);
eq('within window → true', isRecent(new Date(Date.now() - 2 * 86_400_000).toISOString(), 3), true);
eq('outside window → false', isRecent(new Date(Date.now() - 10 * 86_400_000).toISOString(), 3), false);

console.log('\n── util.chunk ─────────────────────────────');
eq('empty → empty', chunk([], 3), []);
eq('partial last → 2 chunks', chunk([1, 2, 3, 4, 5], 3), [[1, 2, 3], [4, 5]]);
eq('exact → 2 chunks', chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);

console.log('\n── tier ordering (matches pipeline.ts) ────');
const tierRank = (t: string | null | undefined): number => {
  const order: Record<string, number> = {
    trusted: 0, creator: 1, enterprise: 1, latam: 1,
    hackernews: 2, rss: 2, reddit: 3, broad: 4, 'content-broad': 4,
  };
  return order[t ?? ''] ?? 5;
};
truthy('trusted before creator', tierRank('trusted') < tierRank('creator'));
truthy('enterprise before hackernews', tierRank('enterprise') < tierRank('hackernews'));
truthy('reddit before broad', tierRank('reddit') < tierRank('broad'));
truthy('unknown tier sorts last', tierRank('mystery') > tierRank('content-broad'));

console.log(`\n──────── ${passed} passed · ${failed} failed ────────\n`);
if (failed > 0) {
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
