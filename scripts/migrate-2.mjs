import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
const url = line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

for (const s of [
  `create table if not exists likes (
    wall_id text not null,
    user_id text not null,
    created timestamptz not null default now()
  )`,
  'create unique index if not exists likes_unique_idx on likes (wall_id, user_id)',
  'alter table wall drop column if exists likes',
  'alter table wall add column if not exists likes int not null default 0'
]) {
  await sql.query(s);
  console.log('ok:', s.slice(0, 60));
}
console.log('MIGRATION 2 OK');
