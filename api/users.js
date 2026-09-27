import { conn, bind, json, readBody, hashToken, authUser, rate } from './_db.js';

const publicUser = (u) => ({
  id: u.id, glyphname: u.glyphname, name: u.name, symbol: u.symbol
});

export default bind(async (req, res) => {
  const sql = conn();

  if (req.method === 'GET') {
    const rows = await sql`select id, glyphname, name, symbol, extract(epoch from now() - seen)::int as seen_ago from users order by created asc limit 500`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    const u = await readBody(req);

    // Presence heartbeat is only valid for the account that owns the token.
    if (u.hb) {
      const me = await authUser(sql, req);
      if (!me || me.id !== u.id) return json(res, { error: 'sign in required' }, 401);
      if (!rate(req, res, { key: 'hb', max: 120, windowMs: 60000 })) return;
      await sql`update users set seen = now() where id = ${me.id}`;
      return json(res, { ok: true });
    }

    if (!rate(req, res, { key: 'signup', max: 10, windowMs: 60000 })) return;
    if (!u.key) return json(res, { error: 'account key required' }, 400);

    // Accept both glyphname and glyphName so client naming can't drift.
    const handle = String(u.glyphname || u.glyphName || '').trim().replace(/^@/, '');
    const bare = handle.toLowerCase();
    if (!bare || bare.length > 30) return json(res, { error: 'glyph name required' }, 400);

    // Normalise identity: a display name is never allowed to be blank or handle-shaped,
    // otherwise every interaction would degrade to "anon"/"someone".
    let name = String(u.name || '').trim().replace(/^@/, '');
    if (!name || name.toLowerCase() === bare) {
      name = bare.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Never mutate an existing account here. Updating on conflict would let any
    // stranger rename someone else's identity; keys are only ever set at signup.
    // Handles are stored with a leading "@", so compare on the stripped form.
    const existing = await sql`
      select id from users
      where lower(glyphname) = ${'@' + bare} or lower(ltrim(glyphname, '@')) = ${bare}
      limit 1`;
    if (existing.length) {
      return json(res, { error: 'that glyph name is taken' }, 409);
    }

    const id = u.id || 'u' + hashToken(handle + u.key).slice(0, 20);
    await sql`
      insert into users (id, glyphname, name, symbol, token_hash)
      values (${id}, ${'@' + bare}, ${name}, ${u.symbol || '✦'}, ${hashToken(u.key)})`;

    return json(res, { ok: true, user: { id, glyphname: '@' + bare, name, symbol: u.symbol || '✦' } });
  }

  return json(res, { error: 'method' }, 405);
});
