import { conn, bind, json, readBody, hashToken, authUser, rate } from './_db.js';

// POST { glyphname, key } -> verifies the account key, returns the user.
// This is what makes handles un-impersonatable: the key is issued once at
// signup (or claimed once for legacy accounts) and required on every device.
export default bind(async (req, res) => {
  const sql = conn();
  if (req.method !== 'POST') return json(res, { error: 'method' }, 405);
  if (!rate(req, res, { key: 'session', max: 20, windowMs: 60000 })) return;

  const b = await readBody(req);
  const handle = String(b.glyphname || '').trim().toLowerCase();
  if (!handle || !b.key) return json(res, { error: 'glyph name and account key required' }, 400);

  const rows = await sql`select * from users where lower(glyphname) = ${handle} limit 1`;
  const u = rows[0];
  if (!u) return json(res, { error: 'no such glyph name' }, 404);

  if (!u.token_hash) {
    // one-time claim for pre-key accounts: the key they provide becomes theirs
    await sql`update users set token_hash = ${hashToken(b.key)} where id = ${u.id}`;
    u.token_hash = hashToken(b.key);
  } else if (u.token_hash !== hashToken(b.key)) {
    return json(res, { error: 'wrong account key' }, 403);
  }

  const me = await authUser(sql, { headers: { 'x-auth-token': b.key } });
  return json(res, { ok: true, user: { id: me.id, glyphname: me.glyphname, name: me.name, symbol: me.symbol } });
});
