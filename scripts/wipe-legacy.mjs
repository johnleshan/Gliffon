import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
const url = line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

for (const s of ['delete from messages', 'delete from wall', 'delete from users']) {
  await sql.query(s);
}
console.log('ALL LEGACY ACCOUNTS + CONTENT DELETED');
