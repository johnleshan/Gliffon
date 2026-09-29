import { conn, bind, json, readBody, authUser, rate } from './_db.js';

// The public glyph directory plus presence. Account creation lives in
// api/auth.js (username + password).
export default bind(async (req, res) => {
  const sql = conn();

  if (req.method === 'GET') {
    const rows = await sql`
      select id, glyphname, name, symbol,
             extract(epoch from now() - seen)::int as seen_ago
      from users order by created asc limit 500`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    const u = await readBody(req);

    // Presence heartbeat is only valid for the account that owns the token.
    if (u.hb) {
      const me = await authUser(sql, req);
      if (!me || me.id !== u.id) return json(res, { error: 'sign in required' }, 401);
      if (!rate(req, res, { key: 'hb', max: 120, windowMs: 60000 })) return;
      await sql`update users set seen = now() where id = ${me.id}`;
      return json(res, { ok: true });
    }

    return json(res, { error: 'create an account with POST /api/auth?action=signup' }, 400);
  }

  return json(res, { error: 'method' }, 405);
});
