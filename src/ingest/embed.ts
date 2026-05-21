import OpenAI from 'openai';
import { env } from '../lib/env.js';
import { chunk } from '../lib/util.js';

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey() });
  return client;
}

const MODEL = 'text-embedding-3-small';
const DIM = 1536;
const BATCH = 96;

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const out: (number[] | null)[] = new Array(texts.length).fill(null);
  const indexed = texts.map((t, i) => ({ i, text: (t ?? '').slice(0, 8000) }));
  const nonEmpty = indexed.filter((x) => x.text.trim().length > 0);
  for (const batch of chunk(nonEmpty, BATCH)) {
    try {
      const resp = await openai().embeddings.create({
        model: MODEL,
        input: batch.map((b) => b.text),
        dimensions: DIM,
      });
      for (let k = 0; k < batch.length; k++) {
        const entry = batch[k];
        const vec = resp.data[k]?.embedding;
        if (entry && vec) out[entry.i] = vec;
      }
    } catch (e) {
      console.error('  [embed] batch failed:', (e as Error).message);
    }
  }
  return out;
}
