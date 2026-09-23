import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
const url = line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

const after = new Date(Date.now() - 60000).toISOString();
const me = 'x';
try {
  const wall = await sql`select id, likes, created, kind, symbol, label, note, author, u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle from wall left join users u on u.id = wall.author order by wall.created desc limit 300`;
  console.log('wall ok', wall.length);
  const msgs = await sql`
    select m.id, m.conv, m.sender, m.text, m.created, u.name as sender_name
    from messages m left join users u on u.id = m.sender
    where m.created > ${after} and m.conv like ${'%' + me + '%'}
    and m.sender <> ${me}
    order by m.created desc limit 50`;
  console.log('msgs ok', msgs.length);
  const presence = await sql`
    select id, extract(epoch from now() - seen) as secs_ago
    from users
    where seen > now() - interval '3 minutes'
    limit 300`;
  console.log('presence ok', presence.length);
} catch (e) {
  console.error('FAIL', e.message);
}
