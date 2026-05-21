import { createHash } from 'node:crypto';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', 'ref', 'ref_src', 'ref_url',
  's', 't', 'src', 'source',
]);

export function canonicalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  try {
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    const u = new URL(s);
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const k of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return s;
  }
}

export function urlHash(canonical: string | null, fallbackTitle?: string): string {
  const key = canonical && canonical.length > 0
    ? canonical
    : `title:${(fallbackTitle ?? '').toLowerCase().slice(0, 120)}`;
  return createHash('sha256').update(key).digest('hex');
}
