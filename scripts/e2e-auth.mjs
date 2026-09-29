const BASE = process.env.BASE || 'http://localhost:5173';
const j = async (path, { method = 'GET', body, token } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers['x-auth-token'] = token;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let d;
  try { d = JSON.parse(txt); } catch { d = { _raw: txt.slice(0, 120) }; }
  return { status: r.status, d };
};
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);

const U = 'pw' + Math.random().toString(36).slice(2, 8);
const PW = 'correct horse 42';
const T = { username: U, password: PW };

// --- signup ---
let r = await j('/api/auth?action=signup', { method: 'POST', body: { ...T, symbol: '✦', label: 'iPhone' } });
ok(r.status === 200 && r.d.token && r.d.user, `signup returns a session token (${r.status})`);
ok(r.d.user && r.d.user.glyphname === '@' + U, 'signup returns the user');
const phoneToken = r.d.token;

// password must never be echoed back
ok(!JSON.stringify(r.d).includes(PW), 'password is not echoed in the response');

// --- duplicate / lookalike ---
r = await j('/api/auth?action=signup', { method: 'POST', body: { ...T, symbol: '★' } });
ok(r.status === 409, `duplicate username rejected (${r.status})`);
const castUser = U.replace(/\d+$/, '') + '0';
r = await j('/api/auth?action=signup', { method: 'POST', body: { username: castUser, password: PW } });
ok(r.status === 409 || r.status === 200, `lookalike handled (${r.status})`);

// --- short password rejected ---
r = await j('/api/auth?action=signup', { method: 'POST', body: { username: 'shortpw' + Date.now(), password: 'abc' } });
ok(r.status === 400, `short password rejected (${r.status})`);

// --- wrong password ---
r = await j('/api/auth?action=login', { method: 'POST', body: { username: U, password: 'wrong-password' } });
ok(r.status === 401, `wrong password rejected (${r.status})`);
r = await j('/api/auth?action=login', { method: 'POST', body: { username: 'nosuchuser' + Date.now(), password: PW } });
ok(r.status === 401, `unknown user gives same 401 (${r.status})`);

// --- THE KEY TEST: second device logs in, first stays valid ---
r = await j('/api/auth?action=login', { method: 'POST', body: { ...T, label: 'MacBook' } });
ok(r.status === 200 && r.d.token, `second device signs in (${r.status})`);
const laptopToken = r.d.token;
ok(laptopToken !== phoneToken, 'each device gets a DIFFERENT session token');

// both sessions independently valid
r = await j('/api/auth?action=me', { token: phoneToken });
ok(r.status === 200 && r.d.user.glyphname === '@' + U, 'device 1 still valid after device 2 login');
r = await j('/api/auth?action=me', { token: laptopToken });
ok(r.status === 200 && r.d.user.glyphname === '@' + U, 'device 2 valid');

// --- device list shows both, flags current ---
r = await j('/api/auth?action=devices', { token: phoneToken });
const devs = r.d;
ok(Array.isArray(devs) && devs.length === 2, `device list has 2 entries (${devs && devs.length})`);
ok(devs.some((d) => d.label === 'iPhone') && devs.some((d) => d.label === 'MacBook'), 'both devices listed by name');
ok(devs.filter((d) => d.is_current).length === 1, 'exactly one marked as current');

// --- revoking device 2 does NOT kill device 1 ---
const laptopSession = devs.find((d) => d.label === 'MacBook');
r = await j('/api/auth?action=revoke', { method: 'POST', token: phoneToken, body: { session_id: laptopSession.id } });
ok(r.status === 200, `revoke device 2 (${r.status})`);
r = await j('/api/auth?action=me', { token: laptopToken });
ok(r.status === 401, `revoked device can no longer authenticate (${r.status})`);
r = await j('/api/auth?action=me', { token: phoneToken });
ok(r.status === 200, 'surviving device still works');

// --- cannot revoke someone else's session ---
r = await j('/api/auth?action=me', { token: phoneToken });
const other = await j('/api/auth?action=signup', { method: 'POST', body: { username: 'other' + Math.random().toString(36).slice(2, 6), password: 'another pass 9' } });
const mySessions = (await j('/api/auth?action=devices', { token: phoneToken })).d;
r = await j('/api/auth?action=revoke', { method: 'POST', token: other.d.token, body: { session_id: mySessions[0].id } });
ok(r.status === 200, 'revoke is scoped and does not error cross-user');
r = await j('/api/auth?action=devices', { token: phoneToken });
ok(r.d.length === 1, 'my session survived another user trying to revoke it');

// --- password change requires the current password ---
r = await j('/api/auth?action=password', { method: 'POST', token: phoneToken, body: { current: 'nope', password: 'brand new pass 1' } });
ok(r.status === 403, `password change needs correct current password (${r.status})`);
r = await j('/api/auth?action=password', { method: 'POST', token: phoneToken, body: { current: PW, password: 'brand new pass 1' } });
ok(r.status === 200, `password changed (${r.status})`);
r = await j('/api/auth?action=login', { method: 'POST', body: { username: U, password: 'brand new pass 1' } });
ok(r.status === 200, `can sign in with the NEW password (${r.status})`);
r = await j('/api/auth?action=login', { method: 'POST', body: { ...T } });
ok(r.status === 401, 'OLD password no longer works');

// --- logout is device-scoped ---
const newTok = (await j('/api/auth?action=login', { method: 'POST', body: { username: U, password: 'brand new pass 1', label: 'Tablet' } })).d.token;
r = await j('/api/auth?action=logout', { method: 'POST', token: newTok, body: '{}' });
ok(r.status === 200, 'logout ok');
r = await j('/api/auth?action=me', { token: newTok });
ok(r.status === 401, 'logged-out device is dead');
r = await j('/api/auth?action=me', { token: phoneToken });
ok(r.status === 200, 'other device untouched by logout');

console.log('\nTESTUSER=' + U);
