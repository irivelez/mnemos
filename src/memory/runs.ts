import { db } from './client.js';

export async function startRun(): Promise<string> {
  const { data, error } = await db()
    .from('ingest_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function finishRun(
  id: string,
  payload: { status: 'ok' | 'partial' | 'failed'; raw_count?: number; deduped?: number; embedded?: number; errors?: unknown[] },
): Promise<void> {
  const { error } = await db()
    .from('ingest_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: payload.status,
      raw_count: payload.raw_count ?? 0,
      deduped: payload.deduped ?? 0,
      embedded: payload.embedded ?? 0,
      errors: payload.errors ?? [],
    })
    .eq('id', id);
  if (error) throw error;
}
