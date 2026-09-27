import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

const env = readFileSync('.env.production', 'utf8');
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);
const hash = (t) => createHash('sha256').update(String(t)).digest('hex');

const stmts = [
  `alter table users add column if not exists token_hash text`,
  `create table if not exists comments (
     id text primary key, wall_id text not null, author text not null,
     text text not null, created timestamptz not null default now())`,
  `create table if not exists follows (
     follower text not null, followee text not null,
     created timestamptz not null default now(),
     primary key (follower, followee))`,
  `create table if not exists blocks (
     blocker text not null, blocked text not null,
     created timestamptz not null default now(),
     primary key (blocker, blocked))`,
  `create table if not exists reports (
     id text primary key, reporter text not null, kind text not null,
     target_id text not null, reason text not null default '',
     created timestamptz not null default now())`,
  `create table if not exists events (
     id bigserial primary key, user_id text, name text not null,
     meta jsonb not null default '{}', created timestamptz not null default now())`,
  `create table if not exists push_subs (
     user_id text not null, endpoint text not null,
     p256dh text not null, auth text not null,
     created timestamptz not null default now(),
     primary key (user_id, endpoint))`,
  `create index if not exists wall_created_idx on wall (created desc)`,
  `create index if not exists wall_author_idx on wall (author)`,
  `create index if not exists likes_wall_idx on likes (wall_id)`,
  `create index if not exists likes_user_idx on likes (user_id)`,
  `create index if not exists messages_conv_idx on messages (conv, created)`,
  `create index if not exists messages_sender_idx on messages (sender)`,
  `create index if not exists users_seen_idx on users (seen)`,
  `create index if not exists comments_wall_idx on comments (wall_id, created)`,
  `create index if not exists follows_followee_idx on follows (followee)`,
  `create index if not exists events_name_idx on events (name, created)`
];
for (const s of stmts) {
  await sql.query(s);
  console.log('ok:', s.slice(0, 70));
}

// Issue recovery keys to existing accounts (hand these to their owners once).
const legacy = await sql`select id, glyphname from users where token_hash is null`;
for (const u of legacy) {
  const key = randomBytes(24).toString('base64url');
  await sql`update users set token_hash = ${hash(key)} where id = ${u.id}`;
  console.log(`KEY for ${u.glyphname}: ${key}`);
}
console.log('MIGRATION 3 OK');
