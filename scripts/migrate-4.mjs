import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

// Adds password auth + multi-device sessions.
// Users keep their existing handle. Existing accounts have no password yet —
// they set one from Settings on a device that still holds their session.
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
  `alter table users add column if not exists password_hash text`,
  // One row per signed-in device. Multiple rows per user = signed in on
  // several devices at once, which is the whole point.
  `create table if not exists sessions (
     id text primary key,
     user_id text not null references users(id) on delete cascade,
     token_hash text not null unique,
     label text,
     created timestamptz not null default now(),
     last_seen timestamptz not null default now()
   )`,
  `create index if not exists sessions_user_idx on sessions(user_id)`,
  `create index if not exists sessions_token_idx on sessions(token_hash)`
];

for (const s of stmts) {
  await sql.query(s);
  console.log('ok:', s.split('\n')[0].slice(0, 60));
}

// Seed a session for anyone already holding a legacy key, so nobody is logged
// out by this migration.
const legacy = await sql`select id, token_hash from users where token_hash is not null`;
let seeded = 0;
for (const u of legacy) {
  const exists = await sql`select 1 from sessions where user_id = ${u.id} limit 1`;
  if (exists.length) continue;
  await sql`
    insert into sessions (id, user_id, token_hash, label)
    values (${'s' + Math.random().toString(36).slice(2) + Date.now().toString(36)},
            ${u.id}, ${u.token_hash}, 'legacy key')`;
  seeded++;
}
console.log('legacy sessions seeded:', seeded);

const cols = await sql`select column_name from information_schema.columns where table_name='users' and column_name='password_hash'`;
console.log('password_hash present:', cols.length === 1);
const sess = await sql`select count(*)::int as n from sessions`;
console.log('sessions:', sess[0].n);
