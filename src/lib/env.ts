import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name];
}

export const env = {
  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseServiceKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  openaiKey: () => required('OPENAI_API_KEY'),
  birdAuthToken: () => optional('BIRD_AUTH_TOKEN'),
  birdCt0: () => optional('BIRD_CT0'),
  braveApiKey: () => optional('BRAVE_API_KEY'),
  anthropicKey: () => optional('ANTHROPIC_API_KEY'),
};

export const MAX_AGE_DAYS = 3;
