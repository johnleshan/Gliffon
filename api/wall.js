import { conn, bind, json } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();

  if (req.method === 'GET') {
    const rows = await sql`
      select wall.*, u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
      from wall left join users u on u.id = wall.author
      order by wall.created desc limit 300`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    const g = await new Promise((ok, err) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { err(new Error('bad json')); } });
    });
    await sql`
      insert into wall (id, kind, symbol, label, note, likes, author)
      values (${g.id}, ${g.kind}, ${g.symbol}, ${g.label}, ${g.note || null}, 0, ${g.author || null})
      on conflict (id) do nothing`;
    return json(res, { ok: true });
  }

  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('id');

  if (req.method === 'PATCH') {
    await sql`update wall set likes = likes + 1 where id = ${id}`;
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`delete from wall where id = ${id}`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});
