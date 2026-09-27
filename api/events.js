import { conn, bind, json, readBody, authUser, rate } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'event', max: 300, windowMs: 60000 })) return;
    const b = await readBody(req);
    if (!b.name) return json(res, { error: 'name required' }, 400);
    await sql`insert into events (user_id, name, meta) values (${me.id}, ${b.name}, ${JSON.stringify(b.meta || {})})`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});