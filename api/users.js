import { conn, bind, json, readBody, hashToken, rate } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();

  if (req.method === 'GET') {
    const rows = await sql`select id, glyphname, name, symbol, extract(epoch from now() - seen)::int as seen_ago from users order by created asc limit 500`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    const u = await readBody(req);
    if (u.hb && u.id) {
      // presence heartbeat
      await sql`update users set seen = now() where id = ${u.id}`;
      return json(res, { ok: true });
    }
    if (!rate(req, res, { key: 'signup', max: 10, windowMs: 60000 })) return;
    if (!u.key) return json(res, { error: 'account key required' }, 400);

    // Normalise identity: a display name is never allowed to be blank or handle-shaped,
    // otherwise every interaction would degrade to "anon"/"someone".
    const handle = String(u.glyphname || '').trim().replace(/^@/, '');
    const bare = handle.toLowerCase();
    let name = String(u.name || '').trim().replace(/^@/, '');
    if (!name || name.toLowerCase() === bare) {
      name = bare.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    await sql`
      insert into users (id, glyphname, name, symbol, token_hash)
      values (${u.id}, ${'@' + handle}, ${name}, ${u.symbol || '✦'}, ${hashToken(u.key)})
      on conflict (glyphname) do update set name = excluded.name, symbol = excluded.symbol`;
    return json(res, { ok: true, name });
  }

  return json(res, { error: 'method' }, 405);
});
