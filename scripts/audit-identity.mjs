import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

const users = await sql`select id, name, glyphname, symbol from users order by created`;
console.log('USERS:', users.length);
for (const u of users) console.log(' -', u.id, '|', u.name, '|', u.glyphname, '|', u.symbol);

const ghosts = await sql`select w.id, w.author, w.label from wall w left join users u on u.id = w.author where u.id is null`;
console.log('ORPHAN WALL ROWS:', ghosts.length);
for (const g of ghosts) console.log(' -', g.id, '| author', g.author, '|', g.label);

const gmsg = await sql`select m.id, m.sender, m.text from messages m left join users u on u.id = m.sender where u.id is null`;
console.log('ORPHAN MESSAGES:', gmsg.length);
for (const m of gmsg) console.log(' -', m.id, '| sender', m.sender, '|', m.text);

const nameless = await sql`select id, name, glyphname from users where name is null or btrim(name) = ''`;
console.log('USERS WITHOUT NAME:', nameless.length);
for (const n of nameless) console.log(' -', n.id, n.glyphname);
