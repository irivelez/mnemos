import { embedTexts, EMBED_DIM } from '../src/ingest/embed.js';

const samples = [
  'Anthropic released Claude Sonnet 4.6 with new agent capabilities.',
  'Claude Sonnet 4.6 launches with improved agentic features at Anthropic.',
  'How to bake sourdough bread in a Dutch oven.',
];

const t0 = Date.now();
const vecs = await embedTexts(samples);
const ms = Date.now() - t0;

let ok = true;
const fail = (msg: string) => { console.log('FAIL ' + msg); ok = false; };
const pass = (msg: string) => console.log('ok   ' + msg);

if (vecs.length !== samples.length) fail(`expected ${samples.length} vectors, got ${vecs.length}`);
else pass(`returned ${vecs.length} vectors in ${ms}ms`);

for (let i = 0; i < vecs.length; i++) {
  const v = vecs[i];
  if (!v) { fail(`vector ${i} is null`); continue; }
  if (v.length !== EMBED_DIM) { fail(`vector ${i} has ${v.length} dims, want ${EMBED_DIM}`); continue; }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (Math.abs(norm - 1) > 0.05) fail(`vector ${i} not unit-normalized (norm=${norm.toFixed(3)})`);
  else pass(`vector ${i} is ${v.length}-dim, unit-normalized (norm=${norm.toFixed(3)})`);
}

const cos = (a: number[], b: number[]): number => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
};

const v0 = vecs[0];
const v1 = vecs[1];
const v2 = vecs[2];
if (v0 && v1 && v2) {
  const simSemantic = cos(v0, v1);
  const simUnrelated = cos(v0, v2);
  pass(`cos(claude_a, claude_b) = ${simSemantic.toFixed(3)} (should be high, near 0.8+)`);
  pass(`cos(claude_a, sourdough) = ${simUnrelated.toFixed(3)} (should be much lower)`);
  if (simSemantic <= simUnrelated) fail(`semantically related sentences should be closer than unrelated`);
  else pass('semantic > unrelated: embeddings are doing real work');
}

process.exit(ok ? 0 : 1);
