import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from '@vercel/postgres';

async function main() {
  const file = resolve(process.cwd(), 'scripts/db/schema.sql');
  const ddl = readFileSync(file, 'utf8');
  console.log('Running migration…');
  await sql.query(ddl);
  console.log('✓ Migration applied');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
