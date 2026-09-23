import { conn, bind } from './_db.js';

export default bind(async (req) => {
  const sql = conn();

  if (req.method === 'GET') {
    const rows = await sql`select id, glyphname, name, symbol, created from users order by created asc limit 500`;
    return rows;
  }

  if (req.method === 'POST') {
    const u = await req.json();
    await sql`
      insert into users (id, glyphname, name, symbol)
      values (${u.id}, ${u.glyphname}, ${u.name}, ${u.symbol || '✦'})
      on conflict (glyphname) do nothing`;
    return { ok: true };
  }

  return { error: 'method' };
});
