import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';

// One-off password (re)set for an account, straight from the terminal:
//   node scripts/set-password.mjs '@john' 's3cure-pass'
// Uses the same scrypt$N$r$p$salt$key format as api/_db.js so verifyPassword accepts it.
const [handle, password] = process.argv.slice(2);
if (!handle || !password) {
  console.log('usage: node scripts/set-password.mjs <@handle|handle> <new password>');
  process.exit(1);
}
if (password.length < 8) {
  console.log('error: password must be at least 8 characters');
  process.exit(1);
}

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

const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const key = scryptSync(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
const hash = ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');

const clean = '@' + handle.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
const res = await sql`update users set password_hash = ${hash} where lower(glyphname) = ${clean} returning glyphname`;
if (!res.length) {
  console.log('no account found for', clean);
  process.exit(1);
}
console.log('password set for', res[0].glyphname);
