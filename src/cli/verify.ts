import { db } from '../memory/client.js';
import { embedTexts, EMBED_DIM } from '../ingest/embed.js';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function verifySetup(): Promise<Check[]> {
  const checks: Check[] = [];

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    checks.push({
      name: 'env: SUPABASE_URL set',
      ok: Boolean(url && url.startsWith('https://')),
      detail: url ? url.replace(/^https:\/\/([^.]+)\..*/, 'https://$1.supabase.co') : 'missing',
    });
    checks.push({
      name: 'env: SUPABASE_SERVICE_ROLE_KEY set',
      ok: Boolean(key && key.length > 40),
      detail: key ? `${key.slice(0, 8)}…${key.slice(-4)}` : 'missing',
    });
  } catch (e) {
    checks.push({ name: 'env: load', ok: false, detail: (e as Error).message });
    return checks;
  }

  try {
    const supa = db();
    const { error } = await supa.from('articles').select('id').limit(1);
    if (error && error.code === '42P01') {
      checks.push({
        name: 'db: articles table exists',
        ok: false,
        detail: 'table not found — run supabase/migrations/0001_init.sql in SQL editor',
      });
    } else if (error) {
      checks.push({ name: 'db: connection', ok: false, detail: `${error.code}: ${error.message}` });
      return checks;
    } else {
      checks.push({ name: 'db: connection + articles table', ok: true, detail: 'reachable' });
    }
  } catch (e) {
    checks.push({ name: 'db: connection', ok: false, detail: (e as Error).message });
    return checks;
  }

  try {
    const supa = db();
    const { error } = await supa.from('temporal_facts').select('id').limit(1);
    checks.push({
      name: 'db: temporal_facts table exists',
      ok: !error || error.code !== '42P01',
      detail: error?.code === '42P01' ? 'missing — re-run 0001_init.sql' : 'present',
    });
  } catch (e) {
    checks.push({ name: 'db: temporal_facts', ok: false, detail: (e as Error).message });
  }

  try {
    const supa = db();
    const { error } = await supa.rpc('mnemos_search', {
      query_embedding: new Array(EMBED_DIM).fill(0.001),
      match_count: 1,
    });
    checks.push({
      name: `db: mnemos_search RPC (${EMBED_DIM}-dim)`,
      ok: !error,
      detail: error
        ? `${error.code}: ${error.message} — run 0002_search_fn.sql`
        : 'callable',
    });
  } catch (e) {
    checks.push({ name: 'db: mnemos_search RPC', ok: false, detail: (e as Error).message });
  }

  try {
    const t0 = Date.now();
    const [vec] = await embedTexts(['mnemos verify test']);
    const ms = Date.now() - t0;
    checks.push({
      name: `embed: local MiniLM (${EMBED_DIM}-dim)`,
      ok: Boolean(vec && vec.length === EMBED_DIM),
      detail: vec ? `${vec.length}-dim in ${ms}ms` : 'failed',
    });
  } catch (e) {
    checks.push({ name: 'embed: local MiniLM', ok: false, detail: (e as Error).message });
  }

  try {
    const supa = db();
    const probeHash = `mnemos-verify-${Date.now()}`;
    const { error: insErr } = await supa.from('articles').insert({
      source: 'verify',
      title: 'mnemos verify roundtrip',
      url_hash: probeHash,
      embedding: new Array(EMBED_DIM).fill(0),
    });
    if (insErr) {
      checks.push({ name: 'db: write roundtrip', ok: false, detail: insErr.message });
    } else {
      const { error: delErr } = await supa.from('articles').delete().eq('url_hash', probeHash);
      checks.push({
        name: 'db: write+delete roundtrip',
        ok: !delErr,
        detail: delErr ? delErr.message : 'service-role can write and delete',
      });
    }
  } catch (e) {
    checks.push({ name: 'db: write roundtrip', ok: false, detail: (e as Error).message });
  }

  return checks;
}

export function printChecks(checks: Check[]): boolean {
  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? 'ok  ' : 'FAIL';
    console.log(`  ${mark} · ${c.name.padEnd(40)} · ${c.detail}`);
    if (!c.ok) allOk = false;
  }
  console.log();
  if (allOk) console.log('  ✓ ready to ingest — run: npm run ingest');
  else console.log('  ✗ fix the failures above before running ingest');
  return allOk;
}
