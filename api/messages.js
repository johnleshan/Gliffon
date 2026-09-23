import { conn, bind, json } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET') {
    const conv = url.searchParams.get('conv');
    if (!conv) return json(res, { error: 'conv required' }, 400);
    const rows = await sql`select * from messages where conv = ${conv} order by created asc limit 400`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    const m = await new Promise((ok, err) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { err(new Error('bad json')); } });
    });
    await sql`
      insert into messages (id, conv, sender, text)
      values (${m.id}, ${m.conv}, ${m.sender}, ${m.text})
      on conflict (id) do nothing`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});
