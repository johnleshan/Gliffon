import { conn, bind, json, readBody, authUser, rate } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'report', max: 20, windowMs: 60000 })) return;
    const b = await readBody(req);
    if (!b.kind || !b.target_id) return json(res, { error: 'kind and target_id required' }, 400);
    await sql`
      insert into reports (id, reporter, kind, target_id, reason)
      values (${b.id}, ${me.id}, ${b.kind}, ${b.target_id}, ${String(b.reason || '').slice(0, 500)})
      on conflict (id) do nothing`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});