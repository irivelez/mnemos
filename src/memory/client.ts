import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../lib/env.js';

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return cached;
}
