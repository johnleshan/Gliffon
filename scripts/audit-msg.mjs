import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

const cols = await sql`select column_name from information_schema.columns where table_name = 'messages' order by ordinal_position`;
console.log('messages cols:', cols.map((c) => c.column_name).join(', '));

const n = await sql`select count(*)::int as c from messages`;
console.log('messages rows:', n[0].c);
