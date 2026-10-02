import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

// Painted glyphs: an svg blob on wall rows for casts, and a personal
// collection table for paintings that have not been cast (yet).
const env = readFileSync('.env.production', 'utf8');
const url = env
  .split('\n')
  .find((l) => l.startsWith('DATABASE_URL='))
  .split('=')
  .slice(1)
  .join('=')
  .trim()
  .replace(/^"|"$/g, '');
const sql = neon(url);

const stmts = [
  `alter table wall add column if not exists svg text`,
  `create table if not exists paintings (
     id text primary key,
     user_id text not null references users(id) on delete cascade,
     svg text not null,
     created timestamptz not null default now()
   )`,
  `create index if not exists paintings_user_idx on paintings(user_id, created desc)`
];

for (const s of stmts) {
  await sql.query(s);
  console.log('ok:', s.split('\n')[0].slice(0, 60));
}

const t = await sql`select count(*)::int as n from information_schema.tables where table_name='paintings'`;
const c = await sql`select count(*)::int as n from information_schema.columns where table_name='wall' and column_name='svg'`;
console.log('paintings present:', t[0].n === 1, '| wall.svg present:', c[0].n === 1);
