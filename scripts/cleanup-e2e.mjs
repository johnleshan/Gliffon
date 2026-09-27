import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

// Removes throwaway e2e accounts and everything they touched.
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

const rows = await sql`select id, glyphname from users where glyphname like '@e2e%'`;
if (!rows.length) {
  console.log('no e2e users to clean');
  process.exit(0);
}

for (const u of rows) {
  await sql`delete from likes where user_id = ${u.id}`;
  await sql`delete from comments where author = ${u.id}`;
  await sql`delete from messages where sender = ${u.id}`;
  await sql`delete from messages where conv like ${'%' + u.id + '%'}`;
  await sql`delete from events where user_id = ${u.id}`;
  await sql`delete from reports where reporter = ${u.id}`;
  await sql`delete from follows where follower = ${u.id} or followee = ${u.id}`;
  await sql`delete from blocks where blocker = ${u.id} or blocked = ${u.id}`;
  await sql`delete from push_subs where user_id = ${u.id}`;
  await sql`delete from wall where author = ${u.id}`;
  await sql`delete from users where id = ${u.id}`;
  console.log('removed', u.glyphname);
}

const left = await sql`select count(*)::int as n from users where glyphname like '@e2e%'`;
console.log('remaining e2e users:', left[0].n);
