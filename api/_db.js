import { neon } from '@neondatabase/serverless';

export function conn() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not configured');
  return neon(url);
}

const CORS = (req) => ({
  'content-type': 'application/json',
  'access-control-allow-origin': req.headers.get('origin') || '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type'
});

export function json(req, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS(req) });
}

export const bind = (fn) => async (req) => {
  if (req.method === 'OPTIONS') return json(req, {});
  try {
    return json(req, await fn(req));
  } catch (e) {
    return json(req, { error: e.message }, 500);
  }
};
