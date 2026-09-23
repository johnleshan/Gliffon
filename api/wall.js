import { conn, bind } from './_db.js';

export default bind(async (req) => {
  const sql = conn();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const rows = await sql`
      select wall.*, u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
      from wall left join users u on u.id = wall.author
      order by wall.created desc limit 300`;
    return rows;
  }

  if (req.method === 'POST') {
    const g = await req.json();
    await sql`
      insert into wall (id, kind, symbol, label, note, likes, author)
      values (${g.id}, ${g.kind}, ${g.symbol}, ${g.label}, ${g.note || null}, 0, ${g.author || null})
      on conflict (id) do nothing`;
    return { ok: true };
  }

  const id = url.searchParams.get('id');

  if (req.method === 'PATCH') {
    await sql`update wall set likes = likes + 1 where id = ${id}`;
    return { ok: true };
  }

  if (req.method === 'DELETE') {
    await sql`delete from wall where id = ${id}`;
    return { ok: true };
  }

  return { error: 'method' };
});
