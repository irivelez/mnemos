import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'supabase', 'migrations');

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }
  const files = (await readdir(MIG_DIR)).filter((f) => f.endsWith('.sql')).sort();
  console.log(`Found ${files.length} migration file(s) in ${MIG_DIR}.\n`);
  console.log('Run these in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new):\n');
  for (const f of files) {
    const sql = await readFile(join(MIG_DIR, f), 'utf-8');
    console.log(`──── ${f} ────`);
    console.log(sql);
    console.log();
  }
  console.log('Or pipe into psql:');
  console.log(`  cat supabase/migrations/*.sql | psql "$DATABASE_URL"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
