import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

// Per-conversation read markers so an unread badge can be attributed to a
// specific person, and cleared by opening that thread.
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
  `create table if not exists conv_reads (
     conv text not null,
     user_id text not null references users(id) on delete cascade,
     read_at timestamptz not null default now(),
     primary key (conv, user_id)
   )`,
  // Conversation discovery scans both participants, so index the raw column.
  `create index if not exists messages_conv_idx on messages(conv)`,
  `create index if not exists messages_created_idx on messages(created desc)`
];

for (const s of stmts) {
  await sql.query(s);
  console.log('ok:', s.split('\n')[0].slice(0, 60));
}

const t = await sql`select count(*)::int as n from information_schema.tables where table_name='conv_reads'`;
console.log('conv_reads present:', t[0].n === 1);
