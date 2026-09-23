import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
const url = line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

for (const s of [
  'alter table users add column if not exists seen timestamptz not null default now()',
  'update users set seen = now()',
  'create index if not exists messages_created_idx on messages (created desc)'
]) {
  await sql.query(s);
  console.log('ok:', s.slice(0, 60));
}
console.log('MIGRATION OK');
