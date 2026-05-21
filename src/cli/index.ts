#!/usr/bin/env node
import { Command } from 'commander';
import { runIngest } from '../ingest/pipeline.js';
import { searchByQuery } from '../retrieval/search.js';
import { trending } from '../retrieval/trending.js';
import { novelOfToday } from '../retrieval/novelty.js';
import { correlateAcrossSources } from '../retrieval/correlate.js';
import { suggestAngles } from '../retrieval/angles.js';
import { verifySetup, printChecks } from './verify.js';

const program = new Command();

program
  .name('feed')
  .description('mnemos — memory for content. Ingest + retrieve across X, HN, RSS, Reddit, search.')
  .version('0.1.0');

program
  .command('verify')
  .description('Pre-flight check: env + Supabase connection + tables + RPC + embeddings + roundtrip.')
  .action(async () => {
    console.log('\nmnemos verify\n');
    const checks = await verifySetup();
    const ok = printChecks(checks);
    process.exit(ok ? 0 : 1);
  });

program
  .command('ingest')
  .description('Run a full fetch from every source, dedupe, embed, persist to Supabase.')
  .option('--dry-run', 'Skip writing to DB; print the plan.', false)
  .action(async (opts: { dryRun: boolean }) => {
    const summary = await runIngest({ dryRun: opts.dryRun });
    console.log('\n──────── ingest summary ────────');
    console.log(JSON.stringify(summary, null, 2));
  });

program
  .command('search <query...>')
  .description('Semantic search over the corpus.')
  .option('-n, --limit <n>', 'max results', (v) => parseInt(v, 10), 10)
  .action(async (queryParts: string[], opts: { limit: number }) => {
    const query = queryParts.join(' ');
    const hits = await searchByQuery(query, opts.limit);
    for (const h of hits) {
      const sim = h.similarity?.toFixed(3) ?? '?';
      console.log(`\n[${sim}] ${h.title}`);
      console.log(`  ${h.source}/${h.tier ?? '-'} · ${h.author ?? h.source_name ?? '-'} · ${h.published_at ?? '?'}`);
      if (h.url) console.log(`  ${h.url}`);
    }
    console.log(`\n${hits.length} hits.`);
  });

program
  .command('trending')
  .description('Top items by engagement in the last N hours.')
  .option('-h, --hours <n>', 'window in hours', (v) => parseInt(v, 10), 24)
  .option('-n, --limit <n>', 'max results', (v) => parseInt(v, 10), 20)
  .option('-t, --tiers <list>', 'comma-separated tier filter (trusted,creator,enterprise,latam,rss,hackernews,reddit)')
  .action(async (opts: { hours: number; limit: number; tiers?: string }) => {
    const tiers = opts.tiers ? opts.tiers.split(',').map((s) => s.trim()) : undefined;
    const hits = await trending({ hours: opts.hours, limit: opts.limit, tiers });
    for (const h of hits) {
      console.log(`\n[${h.engagement_score}] ${h.title}`);
      console.log(`  ${h.source}/${h.tier ?? '-'} · ${h.author ?? h.source_name ?? '-'} · ${h.published_at ?? '?'}`);
      if (h.url) console.log(`  ${h.url}`);
    }
    console.log(`\n${hits.length} items in last ${opts.hours}h.`);
  });

program
  .command('novel')
  .description('Items in the last 24h that are most semantically novel vs the past 7 days.')
  .option('-n, --limit <n>', 'max results', (v) => parseInt(v, 10), 15)
  .action(async (opts: { limit: number }) => {
    const hits = await novelOfToday(opts.limit);
    for (const h of hits) {
      console.log(`\n[novelty=${h.novelty_score.toFixed(3)}] ${h.title}`);
      console.log(`  ${h.source}/${h.tier ?? '-'} · ${h.published_at ?? '?'}`);
      if (h.url) console.log(`  ${h.url}`);
    }
    console.log(`\n${hits.length} novel items.`);
  });

program
  .command('correlate <query...>')
  .description('Show how a topic appears across sources (X / HN / RSS / Reddit / Search).')
  .option('-p, --per-source <n>', 'hits per source', (v) => parseInt(v, 10), 3)
  .action(async (queryParts: string[], opts: { perSource: number }) => {
    const query = queryParts.join(' ');
    const cluster = await correlateAcrossSources(query, opts.perSource);
    console.log(`\nTopic: "${cluster.query}" — appears in ${cluster.sourceCount} source(s).\n`);
    for (const [src, hits] of Object.entries(cluster.bySource)) {
      console.log(`── ${src} (${hits.length}) ──`);
      for (const h of hits) {
        console.log(`  [${h.similarity?.toFixed(3) ?? '?'}] ${h.title}`);
        if (h.url) console.log(`    ${h.url}`);
      }
    }
  });

program
  .command('angles')
  .description('Suggest newsletter angles by clustering trending + novel items across sources.')
  .option('-n, --limit <n>', 'max angles', (v) => parseInt(v, 10), 8)
  .action(async (opts: { limit: number }) => {
    const angles = await suggestAngles(opts.limit);
    for (const a of angles) {
      console.log(`\n▸ ${a.topic}`);
      console.log(`  hook: ${a.hook}`);
      console.log(`  sources: ${a.sourceMix.join(', ')}`);
      for (const u of a.sourceUrls) console.log(`    ${u}`);
    }
    console.log(`\n${angles.length} angle candidates.`);
  });

program.parseAsync().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
