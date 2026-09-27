import { conn, bind, json, readBody, authUser, rate } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'pushsub', max: 10, windowMs: 60000 })) return;
    const b = await readBody(req);
    if (!b.endpoint || !b.keys?.p256dh || !b.keys?.auth) return json(res, { error: 'endpoint and keys required' }, 400);
    await sql`
      insert into push_subs (user_id, endpoint, p256dh, auth)
      values (${me.id}, ${b.endpoint}, ${b.keys.p256dh}, ${b.keys.auth})
      on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`;
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const b = await readBody(req);
    if (!b.endpoint) return json(res, { error: 'endpoint required' }, 400);
    await sql`delete from push_subs where user_id = ${me.id} and endpoint = ${b.endpoint}`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});