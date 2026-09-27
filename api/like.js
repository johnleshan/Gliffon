import { conn, bind, json, readBody, authUser, rate } from './_db.js';
import { sendToUser } from './_push.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'like', max: 120, windowMs: 60000 })) return;
    const b = await readBody(req);
    if (!b.wall_id) return json(res, { error: 'wall_id required' }, 400);

    const exists = await sql`select 1 from likes where wall_id = ${b.wall_id} and user_id = ${me.id}`;
    if (exists.length) return json(res, { ok: true, already: true });

    await sql`insert into likes (wall_id, user_id) values (${b.wall_id}, ${me.id})`;
    await sql`update wall set likes = likes + 1 where id = ${b.wall_id}`;

    // notify the glyph owner out-of-band so they see it even when the app is closed
    const owner = await sql`
      select w.author, w.label, u.glyphname from wall w
      join users u on u.id = w.author where w.id = ${b.wall_id} limit 1`;
    if (owner.length && owner[0].author !== me.id) {
      sendToUser(sql, owner[0].author, {
        title: `${me.glyphname} liked your glyph`,
        body: `${me.symbol} "${owner[0].label}"`,
        icon: '/icon.svg',
        data: { url: '/g/' + b.wall_id }
      }).catch(() => {});
    }

    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});