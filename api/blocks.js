import { conn, bind, json, readBody, authUser, rate } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'GET') {
    const rows = await sql`
      select u.id, u.glyphname, u.name, u.symbol
      from blocks b join users u on u.id = b.blocked
      where b.blocker = ${me.id} order by b.created desc`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'block', max: 30, windowMs: 60000 })) return;
    const b = await readBody(req);
    const target = String(b.glyphname || '').trim().toLowerCase();
    if (!target) return json(res, { error: 'glyph name required' }, 400);
    const rows = await sql`select id from users where lower(glyphname) = ${target} limit 1`;
    if (!rows.length) return json(res, { error: 'no such glyph name' }, 404);
    const targetId = rows[0].id;
    if (targetId === me.id) return json(res, { error: "can't block yourself" }, 400);
    await sql`insert into blocks (blocker, blocked) values (${me.id}, ${targetId}) on conflict do nothing`;
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const b = await readBody(req);
    const target = String(b.glyphname || '').trim().toLowerCase();
    if (!target) return json(res, { error: 'glyph name required' }, 400);
    const rows = await sql`select id from users where lower(glyphname) = ${target} limit 1`;
    if (!rows.length) return json(res, { error: 'no such glyph name' }, 404);
    const targetId = rows[0].id;
    await sql`delete from blocks where blocker = ${me.id} and blocked = ${targetId}`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});