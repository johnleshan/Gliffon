import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes } from 'node:crypto';

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
export const newToken = () => randomBytes(24).toString('base64url');

// The caller's account, verified by secret token. Null = anonymous.
// An explicit `key` overrides the header, so the session endpoint can verify a
// key from a request body without trusting the header/identity combination.
export async function authUser(sql, req, key) {
  const tok = key || req.headers['x-auth-token'];
  if (!tok) return null;
  const rows = await sql`select * from users where token_hash = ${hashToken(tok)} limit 1`;
  return rows[0] || null;
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
    json(res, { error: 'slow down — rate limited' }, 429);
    return false;
  }
  return true;
}
