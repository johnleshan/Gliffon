import { conn, bind, json, readBody, authUser, rate } from './_db.js';
import { sendToUser } from './_push.js';

export default bind(async (req, res) => {
  const sql = conn();
  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action') || '';

  if (req.method === 'GET') {
    const rows = await sql`
      select wall.*, u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
      from wall left join users u on u.id = wall.author
      order by wall.created desc limit 300`;
    return json(res, rows);
  }

  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  // Attributed like: POST /api/wall?action=like  body { wall_id }
  if (req.method === 'POST' && action === 'like') {
    if (!rate(req, res, { key: 'like', max: 120, windowMs: 60000 })) return;
    const b = await readBody(req);
    if (!b.wall_id) return json(res, { error: 'wall_id required' }, 400);

    const exists = await sql`select 1 from likes where wall_id = ${b.wall_id} and user_id = ${me.id}`;
    if (exists.length) return json(res, { ok: true, already: true });

    const target = await sql`select author from wall where id = ${b.wall_id} limit 1`;
    if (!target.length) return json(res, { error: 'not found' }, 404);

    await sql`insert into likes (wall_id, user_id) values (${b.wall_id}, ${me.id})`;
    await sql`update wall set likes = likes + 1 where id = ${b.wall_id}`;

    // Notify the owner, but never notify yourself about your own like.
    if (target[0].author !== me.id) {
      const owner = await sql`
        select w.label from wall w where w.id = ${b.wall_id} limit 1`;
      if (owner.length) {
        sendToUser(sql, target[0].author, {
          title: `${me.glyphname} liked your glyph`,
          body: `${me.symbol} "${owner[0].label}"`,
          icon: '/icon.svg',
          data: { url: '/g/' + b.wall_id }
        }).catch(() => {});
      }
    }
    return json(res, { ok: true, likes: true });
  }

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

  const id = url.searchParams.get('id');

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
