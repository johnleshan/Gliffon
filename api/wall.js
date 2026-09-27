import { conn, bind, json, readBody, authUser, rate } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();

  if (req.method === 'GET') {
    const rows = await sql`
      select wall.*, u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
      from wall left join users u on u.id = wall.author
      order by wall.created desc limit 300`;
    return json(res, rows);
  }

  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'cast', max: 30, windowMs: 60000 })) return;
    const g = await readBody(req);
    if (!g.label || !g.kind) return json(res, { error: 'kind and label required' }, 400);
    await sql`
      insert into wall (id, kind, symbol, label, note, likes, author)
      values (${g.id}, ${g.kind}, ${g.symbol}, ${String(g.label).slice(0, 280)}, ${(g.note || '').slice(0, 600) || null}, 0, ${me.id})
      on conflict (id) do nothing`;
    return json(res, { ok: true });
  }

  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('id');

  if (req.method === 'PATCH') {
    // legacy anonymous bump kept for offline-sync compatibility, attributed likes go via /api/like
    if (!rate(req, res, { key: 'likebump', max: 60, windowMs: 60000 })) return;
    await sql`update wall set likes = likes + 1 where id = ${id}`;
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const rows = await sql`select author from wall where id = ${id}`;
    if (!rows.length) return json(res, { error: 'not found' }, 404);
    if (rows[0].author !== me.id) return json(res, { error: 'not yours' }, 403);
    await sql`delete from wall where id = ${id}`;
    await sql`delete from likes where wall_id = ${id}`;
    await sql`delete from comments where wall_id = ${id}`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});
