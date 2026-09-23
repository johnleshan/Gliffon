import { conn, bind, json } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();

  if (req.method === 'GET') {
    const rows = await sql`select id, glyphname, name, symbol, extract(epoch from now() - seen)::int as seen_ago from users order by created asc limit 500`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    const u = await new Promise((ok, err) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { err(new Error('bad json')); } });
    });
    if (u.hb && u.id) {
      // presence heartbeat
      await sql`update users set seen = now() where id = ${u.id}`;
      return json(res, { ok: true });
    }
    await sql`
      insert into users (id, glyphname, name, symbol)
      values (${u.id}, ${u.glyphname}, ${u.name}, ${u.symbol || '✦'})
      on conflict (glyphname) do nothing`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});
