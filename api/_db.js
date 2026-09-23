import { neon } from '@neondatabase/serverless';

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
  res.setHeader('access-control-allow-headers', 'content-type');
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
