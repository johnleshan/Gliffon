import { conn, bind, json, readBody, authUser, rate } from './_db.js';
import { sendToUser } from './_push.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://x');
    const conv = url.searchParams.get('conv');
    if (!conv) return json(res, { error: 'conv required' }, 400);
    // confirm the caller is actually a participant before reading anything
    const [a, b] = conv.split('|');
    if (!a || !b || (a !== me.id && b !== me.id)) {
      return json(res, { error: 'not your conversation' }, 403);
    }
    const rows = await sql`
      select m.*, u.name as sender_name, u.symbol as sender_symbol, u.glyphname as sender_handle
      from messages m left join users u on u.id = m.sender
      where m.conv = ${conv} order by m.created asc limit 400`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'message', max: 60, windowMs: 60000 })) return;
    const m = await readBody(req);
    if (!m.conv || !m.text) return json(res, { error: 'conv and text required' }, 400);
    // validate conv belongs to me
    const [a, b] = m.conv.split('|');
    if (a !== me.id && b !== me.id) return json(res, { error: 'not your conversation' }, 403);
    await sql`
      insert into messages (id, conv, sender, text)
      values (${m.id}, ${m.conv}, ${me.id}, ${String(m.text).slice(0, 3000)})
      on conflict (id) do nothing`;

    // ping the other participant on their phone
    const otherId = me.id === a ? b : a;
    if (otherId) {
      sendToUser(sql, otherId, {
        title: `${me.glyphname} sent you a message`,
        body: String(m.text).slice(0, 90),
        icon: '/icon.svg',
        data: { url: '/' }
      }).catch(() => {});
    }
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});