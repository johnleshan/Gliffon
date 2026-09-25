import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

// remove the throwaway test accounts
await sql`delete from likes where user_id in ('t-owner','t-liker')`;
await sql`delete from users where id in ('t-owner','t-liker')`;

// repair handle-shaped display names
const fixed = await sql`
  update users
  set name = regexp_replace(trim(both '@' from glyphname), '[._-]+', ' ', 'g')
  where name is null or btrim(name) = '' or name = glyphname or name = '@' || glyphname
  returning id, glyphname, name`;
console.log('repaired names:', fixed.length);
for (const f of fixed) console.log(' -', f.glyphname, '->', f.name);

const users = await sql`select id, name, glyphname, symbol from users order by created`;
console.log('USERS NOW:', users.length);
for (const u of users) console.log(' -', u.glyphname, '|', u.name, '|', u.symbol);
