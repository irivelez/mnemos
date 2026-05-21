import { embedTexts } from '../ingest/embed.js';
import { semanticSearch, type SearchHit } from '../memory/articles.js';

export async function searchByQuery(query: string, limit = 10): Promise<SearchHit[]> {
  const [vec] = await embedTexts([query]);
  if (!vec) throw new Error('Failed to embed query');
  return semanticSearch(vec, limit);
}
