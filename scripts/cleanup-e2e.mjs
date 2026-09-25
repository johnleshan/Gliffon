import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

await sql`delete from likes where user_id like 'e2e-%' or wall_id like 'e2e-w-%'`;
await sql`delete from messages where conv like '%e2e-%' or conv = 'noop'`;
await sql`delete from wall where id like 'e2e-%' or id like 't-%' or id like 'test%'`;
await sql`delete from users where id like 'e2e-%' or id like 't-%'`;

const users = await sql`select glyphname, name, symbol from users order by created`;
console.log('FINAL USERS:', users.length);
for (const u of users) console.log(' -', u.glyphname, '|', u.name, '|', u.symbol);
const w = await sql`select count(*)::int as c from wall`;
const m = await sql`select count(*)::int as c from messages`;
console.log('wall rows:', w[0].c, '| message rows:', m[0].c);
