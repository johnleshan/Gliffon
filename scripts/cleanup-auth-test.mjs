import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

const rows = await sql`select id, glyphname from users where glyphname like '@pw%' or glyphname like '@other%' or glyphname like '@shortpw%' or glyphname like '@ui%' or glyphname like '@dev%'`;
for (const u of rows) {
  await sql`delete from sessions where user_id = ${u.id}`;
  await sql`delete from wall where author = ${u.id}`;
  await sql`delete from events where user_id = ${u.id}`;
  await sql`delete from users where id = ${u.id}`;
  console.log('removed', u.glyphname);
}
const left = await sql`select glyphname from users order by created asc`;
console.log('remaining:', left.map((u) => u.glyphname).join(', '));
