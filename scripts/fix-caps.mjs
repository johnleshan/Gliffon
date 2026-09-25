import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

const r = await sql`
  update users u
  set name = upper(left(t.b, 1)) || substr(t.b, 2)
  from (
    select id as uid, regexp_replace(initcap(trim(both '@' from glyphname)), '[._-]+', ' ', 'g') as b
    from users
  ) t
  where u.id = t.uid
  returning u.id, u.glyphname, u.name`;
for (const u of r) console.log(u.glyphname, '->', u.name);
