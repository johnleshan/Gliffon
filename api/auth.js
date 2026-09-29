import {
  conn, bind, json, readBody, authUser,
  rate, hashToken, newToken, hashPassword, verifyPassword
} from './_db.js';

// Username + password auth.
//
// Identity is (username, password) — never the device. Signing in creates a
// NEW session row per device, so one account can be open on a phone, a laptop
// and a desktop at the same time without them evicting each other.
//
//   POST /api/auth?action=signup  { username, password, name, symbol }
//   POST /api/auth?action=login   { username, password }
//   POST /api/auth?action=password { current, password }   (set/change, needs session)
//   GET  /api/auth?action=me
//   POST /api/auth?action=logout
//   GET  /api/auth?action=devices
//   POST /api/auth?action=revoke   { session_id }

const clean = (s) =>
  String(s || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9._-]/g, '').replace(/[._-]+/g, '');

// Lookalike guard: j0hn must not pass as john.
const DIGIT_CAST = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
const cast = (n) => n.replace(/[01345789]/g, (c) => DIGIT_CAST[c] || c);

const publicUser = (u) => ({
  id: u.id, glyphname: u.glyphname, name: u.name, symbol: u.symbol
});

async function createSession(sql, userId, label) {
  const token = newToken();
  const id = 's' + newToken().slice(0, 18);
  await sql`
    insert into sessions (id, user_id, token_hash, label)
    values (${id}, ${userId}, ${hashToken(token)}, ${String(label || 'device').slice(0, 40)})`;
  return { token, sessionId: id };
}

export default bind(async (req, res) => {
  const sql = conn();
  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action') || '';

  // ---- who am I (works with the device session token) ----
  if (req.method === 'GET' && action === 'me') {
    const me = await authUser(sql, req);
    if (!me) return json(res, { error: 'not signed in' }, 401);
    await sql`update sessions set last_seen = now() where token_hash = ${hashToken(req.headers['x-auth-token'])}`;
    return json(res, { ok: true, user: publicUser(me) });
  }

  // ---- create account ----
  if (req.method === 'POST' && action === 'signup') {
    if (!rate(req, res, { key: 'signup', max: 8, windowMs: 60000 })) return;
    const b = await readBody(req);

    const username = clean(b.username);
    if (username.length < 3 || username.length > 20 || !/[a-z]/.test(username)) {
      return json(res, { error: 'username must be 3–20 characters: letters, numbers, dots, dashes' }, 400);
    }
    const password = String(b.password || '');
    if (password.length < 8) return json(res, { error: 'password must be at least 8 characters' }, 400);
    if (password.length > 200) return json(res, { error: 'password too long' }, 400);

    // Uniqueness, including lookalikes.
    const taken = await sql`select glyphname from users where lower(glyphname) = ${'@' + username} or lower(ltrim(glyphname, '@')) = ${username}`;
    if (taken.length) return json(res, { error: 'that username is taken' }, 409);
    const clash = await sql`select glyphname from users`;
    const mine = cast(username);
    for (const row of clash) {
      const theirs = clean(row.glyphname);
      if (theirs && cast(theirs) === mine) {
        return json(res, { error: `that username is too similar to ${row.glyphname}` }, 409);
      }
    }

    let name = String(b.name || '').trim().replace(/^@/, '');
    if (!name || name.toLowerCase() === username) {
      name = username.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const id = 'u' + hashToken(username + newToken()).slice(0, 20);
    const symbol = String(b.symbol || '✦').slice(0, 4);

    await sql`
      insert into users (id, glyphname, name, symbol, password_hash)
      values (${id}, ${'@' + username}, ${name}, ${symbol}, ${hashPassword(password)})`;

    const { token, sessionId } = await createSession(sql, id, b.label);
    return json(res, {
      ok: true,
      token,
      session_id: sessionId,
      user: { id, glyphname: '@' + username, name, symbol }
    });
  }

  // ---- sign in ----
  if (req.method === 'POST' && action === 'login') {
    // Tight limit: this is the brute-force surface.
    if (!rate(req, res, { key: 'login', max: 10, windowMs: 60000 })) return;
    const b = await readBody(req);

    const username = clean(b.username);
    const password = String(b.password || '');
    if (!username || !password) return json(res, { error: 'username and password required' }, 400);

    const rows = await sql`select * from users where lower(ltrim(glyphname, '@')) = ${username} limit 1`;
    const u = rows[0];

    // Always run a verify so a missing user and a wrong password cost the
    // same amount of time (no account enumeration by timing).
    const ok = u && u.password_hash
      ? verifyPassword(password, u.password_hash)
      : verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

    if (!u || !ok) return json(res, { error: 'wrong username or password' }, 401);

    if (!u.password_hash) {
      return json(res, {
        error: 'no password set on this account yet',
        needs_password: true,
        legacy: true
      }, 409);
    }

    const { token, sessionId } = await createSession(sql, u.id, b.label);
    return json(res, { ok: true, token, session_id: sessionId, user: publicUser(u) });
  }

  // ---- set or change password (from a signed-in device) ----
  if (req.method === 'POST' && action === 'password') {
    if (!rate(req, res, { key: 'pwchange', max: 6, windowMs: 60000 })) return;
    const me = await authUser(sql, req);
    if (!me) return json(res, { error: 'sign in required' }, 401);

    const b = await readBody(req);
    const password = String(b.password || '');
    if (password.length < 8) return json(res, { error: 'password must be at least 8 characters' }, 400);

    // Existing password must be proven before it can be changed, unless the
    // account has never had one (legacy key-only accounts).
    if (me.password_hash && !verifyPassword(String(b.current || ''), me.password_hash)) {
      return json(res, { error: 'current password is incorrect' }, 403);
    }

    await sql`update users set password_hash = ${hashPassword(password)} where id = ${me.id}`;
    return json(res, { ok: true });
  }

  // ---- sign out of THIS device only ----
  if (req.method === 'POST' && action === 'logout') {
    const tok = req.headers['x-auth-token'];
    if (tok) await sql`delete from sessions where token_hash = ${hashToken(tok)}`;
    return json(res, { ok: true });
  }

  // ---- list signed-in devices ----
  if (req.method === 'GET' && action === 'devices') {
    const me = await authUser(sql, req);
    if (!me) return json(res, { error: 'sign in required' }, 401);
    const rows = await sql`
      select id, label, created, last_seen,
             (token_hash = ${hashToken(req.headers['x-auth-token'])}) as is_current
      from sessions where user_id = ${me.id} order by last_seen desc`;
    return json(res, rows.map((r) => ({
      id: r.id,
      label: r.label,
      created: r.created,
      last_seen: r.last_seen,
      is_current: r.is_current
    })));
  }

  // ---- sign out another device ----
  if (req.method === 'POST' && action === 'revoke') {
    const me = await authUser(sql, req);
    if (!me) return json(res, { error: 'sign in required' }, 401);
    const b = await readBody(req);
    if (!b.session_id) return json(res, { error: 'session_id required' }, 400);
    // Scope to your own sessions so nobody can revoke anyone else's.
    await sql`delete from sessions where id = ${b.session_id} and user_id = ${me.id}`;
    return json(res, { ok: true });
  }

  return json(res, { error: 'method' }, 405);
});
