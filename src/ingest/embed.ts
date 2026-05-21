import { pipeline, env as xenovaEnv, type FeatureExtractionPipeline } from '@xenova/transformers';
import { chunk } from '../lib/util.js';

xenovaEnv.allowLocalModels = false;
xenovaEnv.useBrowserCache = false;

const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;
const BATCH = 16;

let pipe: FeatureExtractionPipeline | null = null;

async function getPipe(): Promise<FeatureExtractionPipeline> {
  if (!pipe) {
    console.log(`  [embed] loading ${MODEL} (first run downloads ~25 MB)...`);
    pipe = (await pipeline('feature-extraction', MODEL)) as FeatureExtractionPipeline;
  }
  return pipe;
}

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const out: (number[] | null)[] = new Array(texts.length).fill(null);
  const indexed = texts.map((t, i) => ({ i, text: (t ?? '').slice(0, 4000) }));
  const nonEmpty = indexed.filter((x) => x.text.trim().length > 0);
  const extractor = await getPipe();

  for (const batch of chunk(nonEmpty, BATCH)) {
    try {
      const result = await extractor(
        batch.map((b) => b.text),
        { pooling: 'mean', normalize: true },
      );
      const arr = result.tolist() as number[][];
      for (let k = 0; k < batch.length; k++) {
        const entry = batch[k];
        const vec = arr[k];
        if (entry && vec) out[entry.i] = vec;
      }
    } catch (e) {
      console.error('  [embed] batch failed:', (e as Error).message);
    }
  }
  return out;
}
