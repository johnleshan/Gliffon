import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

let sqlCache;
export function conn() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not configured');
  if (!sqlCache) sqlCache = neon(url);
  return sqlCache;
}

function cors(res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, x-auth-token');
}

export function json(res, data, status = 200) {
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

export const bind = (fn) => async (req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.end();
  }
  cors(res);
  try {
    await fn(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};

export function readBody(req) {
  return new Promise((ok, err) => {
    let b = '';
    req.on('data', (c) => {
      b += c;
      if (b.length > 200000) err(new Error('body too large'));
    });
    req.on('end', () => {
      try { ok(b ? JSON.parse(b) : {}); } catch { err(new Error('bad json')); }
    });
  });
}

export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

// Password hashing: scrypt, per-user random salt, constant-time compare.
// Stored as scrypt$N$r$p$salt$key so parameters can change over time.
export function hashPassword(password) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const key = scryptSync(String(password), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = scryptSync(String(password), salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// The caller's account, via their device session. Null = anonymous.
// Each signed-in device holds its own session token, so one account can be
// signed in on many devices at once.
export async function authUser(sql, req) {
  const tok = req.headers['x-auth-token'];
  if (!tok) return null;
  const th = hashToken(tok);
  const rows = await sql`
    select u.*, s.id as session_id
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${th} limit 1`;
  const me = rows[0];
  if (me) return me;
  // Legacy fallback: accounts created before sessions existed stored a single
  // key on the user row directly.
  const legacy = await sql`select * from users where token_hash = ${th} limit 1`;
  return legacy[0] || null;
}

// Best-effort per-instance rate limiter (serverless: each isolate tracks its own).
const buckets = new Map();
export function rate(req, res, { key, max, windowMs }) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  const k = `${key}:${ip}`;
  const now = Date.now();
  let b = buckets.get(k);
  if (!b || b.reset < now) b = { count: 0, reset: now + windowMs };
  b.count += 1;
  buckets.set(k, b);
  if (b.count > max) {
    json(res, { error: 'too many attempts — wait a moment and try again' }, 429);
    return false;
  }
  return true;
}
