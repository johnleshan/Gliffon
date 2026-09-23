import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.production', 'utf8');
const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
const url = line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
const sql = neon(url);

const schema = readFileSync('neon-schema.sql', 'utf8');
const statements = schema.split(';').map((s) => s.trim()).filter(Boolean);

for (const s of statements) {
  const label = s.match(/create (table|index|function)?[^(]*/)?.[0]?.slice(0, 60) || s.slice(0, 50);
  await sql.query(s);
  console.log('ok:', label);
}
console.log('SCHEMA APPLIED ✔');
