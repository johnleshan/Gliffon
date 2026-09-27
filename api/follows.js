import { conn, bind, json, readBody, authUser, rate } from './_db.js';
import { sendToUser } from './_push.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://x');
    const type = url.searchParams.get('type') || 'following';
    if (type === 'followers') {
      const rows = await sql`
        select u.id, u.glyphname, u.name, u.symbol
        from follows f join users u on u.id = f.follower
        where f.followee = ${me.id} order by f.created desc`;
      return json(res, rows);
    }
    const rows = await sql`
      select u.id, u.glyphname, u.name, u.symbol
      from follows f join users u on u.id = f.followee
      where f.follower = ${me.id} order by f.created desc`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'follow', max: 60, windowMs: 60000 })) return;
    const b = await readBody(req);
    const target = String(b.glyphname || '').trim().toLowerCase();
    if (!target) return json(res, { error: 'glyph name required' }, 400);
    const rows = await sql`select id from users where lower(glyphname) = ${target} limit 1`;
    if (!rows.length) return json(res, { error: 'no such glyph name' }, 404);
    const targetId = rows[0].id;
    if (targetId === me.id) return json(res, { error: "can't follow yourself" }, 400);
    await sql`insert into follows (follower, followee) values (${me.id}, ${targetId}) on conflict do nothing`;
    if (targetId !== me.id) {
      sendToUser(sql, targetId, {
        title: `${me.glyphname} is now following you`,
        body: `${me.symbol} new follower`,
        icon: '/icon.svg',
        data: { url: '/u/' + me.glyphname }
      }).catch(() => {});
    }
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    const b = await readBody(req);
    const target = String(b.glyphname || '').trim().toLowerCase();
    if (!target) return json(res, { error: 'glyph name required' }, 400);
    const rows = await sql`select id from users where lower(glyphname) = ${target} limit 1`;
    if (!rows.length) return json(res, { error: 'no such glyph name' }, 404);
    const targetId = rows[0].id;
    await sql`delete from follows where follower = ${me.id} and followee = ${targetId}`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});