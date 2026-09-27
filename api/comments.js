import { conn, bind, json, readBody, authUser, rate } from './_db.js';
import { sendToUser } from './_push.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  const url = new URL(req.url, 'http://x');
  const wall_id = url.searchParams.get('wall_id');

  if (req.method === 'GET') {
    if (!wall_id) return json(res, { error: 'wall_id required' }, 400);
    const rows = await sql`
      select c.*, u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
      from comments c left join users u on u.id = c.author
      where c.wall_id = ${wall_id} order by c.created asc`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    if (!wall_id) return json(res, { error: 'wall_id required' }, 400);
    if (!rate(req, res, { key: 'comment', max: 60, windowMs: 60000 })) return;
    const b = await readBody(req);
    if (!b.text) return json(res, { error: 'text required' }, 400);
    await sql`
      insert into comments (id, wall_id, author, text)
      values (${b.id}, ${wall_id}, ${me.id}, ${String(b.text).slice(0, 2000)})
      on conflict (id) do nothing`;

    const owner = await sql`select author, label from wall where id = ${wall_id} limit 1`;
    if (owner.length && owner[0].author !== me.id) {
      sendToUser(sql, owner[0].author, {
        title: `${me.glyphname} commented`,
        body: String(b.text).slice(0, 90),
        icon: '/icon.svg',
        data: { url: '/g/' + wall_id }
      }).catch(() => {});
    }
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});