import { conn, bind } from './_db.js';

export default bind(async (req) => {
  const sql = conn();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const conv = url.searchParams.get('conv');
    if (!conv) return { error: 'conv required' };
    const rows = await sql`select * from messages where conv = ${conv} order by created asc limit 400`;
    return rows;
  }

  if (req.method === 'POST') {
    const m = await req.json();
    await sql`
      insert into messages (id, conv, sender, text)
      values (${m.id}, ${m.conv}, ${m.sender}, ${m.text})
      on conflict (id) do nothing`;
    return { ok: true };
  }

  return { error: 'method' };
});
