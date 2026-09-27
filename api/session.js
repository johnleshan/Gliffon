import { conn, bind, json, readBody, hashToken, authUser, rate } from './_db.js';

// POST { key }                       -> verify the stored token, return the user
// POST { glyphname, key }            -> verify the key for that specific account
// This is what makes handles un-impersonatable: the key is issued once at
// signup and required on every device.
export default bind(async (req, res) => {
  const sql = conn();
  if (req.method !== 'POST') return json(res, { error: 'method' }, 405);
  if (!rate(req, res, { key: 'session', max: 20, windowMs: 60000 })) return;

  const b = await readBody(req);
  const handle = String(b.glyphname || '').trim().replace(/^@/, '').toLowerCase();
  if (!b.key) return json(res, { error: 'account key required' }, 400);

  const u = await authUser(sql, req, b.key);
  if (!u) return json(res, { error: 'wrong account key' }, 403);
  if (handle && u.glyphname.toLowerCase() !== handle) {
    return json(res, { error: 'wrong account key' }, 403);
  }

  return json(res, {
    ok: true,
    user: { id: u.id, glyphname: u.glyphname, name: u.name, symbol: u.symbol }
  });
});
