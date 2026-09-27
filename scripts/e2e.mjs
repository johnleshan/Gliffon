const BASE = 'https://gliffon.vercel.app';
const j = async (path, { method = 'GET', body, token } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers['x-auth-token'] = token;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d };
};
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);

const HANDLE = 'e2e' + Math.random().toString(36).slice(2, 8);
const KEY = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const WID = 'e2e' + Math.random().toString(36).slice(2, 10);
const GID = 'e2eg' + Math.random().toString(36).slice(2, 10);

try {
  // 1. signup
  let r = await j('/api/users', { method: 'POST', body: { glyphName: HANDLE, name: 'E2E Tester', symbol: '◆', key: KEY } });
  ok(r.status === 200 && r.d.user, `signup returns user (${r.status})`);
  const uid = r.d.user.id;

  // 2. session restore by key only
  r = await j('/api/session', { method: 'POST', body: { key: KEY } });
  ok(r.status === 200 && r.d.user?.id === uid, 'token-only session resolves user');

  // 3. wrong key rejected
  r = await j('/api/session', { method: 'POST', body: { key: 'wrong-key-entirely' } });
  ok(r.status === 403, `wrong key rejected (${r.status})`);

  // 4. handle collision does not hijack
  r = await j('/api/users', { method: 'POST', body: { glyphName: HANDLE, name: 'Hijacker', symbol: '☠', key: 'other-key' } });
  ok(r.status === 409, `duplicate handle rejected (${r.status})`);
  const all = await j('/api/users');
  const me = all.d.find((u) => u.glyphname === '@' + HANDLE);
  ok(me?.name === 'E2E Tester' && me?.symbol === '◆', 'existing profile not mutated by collision');

  // 5. cast
  r = await j('/api/wall', { method: 'POST', token: KEY, body: { id: WID, kind: 'love', symbol: '◆', label: 'e2e glyph', note: 'n', author: 'spoof' } });
  ok(r.status === 200, `cast accepted (${r.status})`);
  const wall = await j('/api/wall');
  const mine = wall.d.find((x) => x.id === WID);
  ok(mine?.author === uid, 'author is server-derived, not client-supplied');

  // 6. like someone else's glyph (jane)
  const target = wall.d.find((x) => x.author !== uid);
  r = await j('/api/wall?action=like', { method: 'POST', token: KEY, body: { wall_id: target.id } });
  ok(r.status === 200 && !r.d.already, `like accepted (${r.status})`);
  r = await j('/api/wall?action=like', { method: 'POST', token: KEY, body: { wall_id: target.id } });
  ok(r.d.already === true, 'duplicate like deduped');

  // 7. self-like rejected
  r = await j('/api/wall?action=like', { method: 'POST', token: KEY, body: { wall_id: WID } });
  ok(r.status === 400, `self-like rejected (${r.status})`);

  // 8. ownership enforced on delete
  r = await j('/api/wall?id=' + target.id, { method: 'DELETE', token: KEY });
  ok(r.status === 403, `cannot delete another's glyph (${r.status})`);

  // 9. comments
  r = await j(`/api/comments?wall_id=${target.id}`, { method: 'POST', token: KEY, body: { id: GID, text: 'e2e comment' } });
  ok(r.status === 200, `comment posted (${r.status})`);
  r = await j(`/api/comments?wall_id=${target.id}`, { token: KEY });
  ok(r.d.some((c) => c.id === GID), 'comment listed');
  ok(r.d.find((c) => c.id === GID)?.author_handle === '@' + HANDLE, 'comment attributed to me');

  // 10. follow / unfollow
  r = await j('/api/social?action=follow', { method: 'POST', token: KEY, body: { glyphname: target.author_handle } });
  ok(r.status === 200, `follow accepted (${r.status})`);
  r = await j('/api/social?type=following', { token: KEY });
  ok(r.d.length === 1, 'following list has 1');
  await j('/api/social?action=unfollow', { method: 'DELETE', token: KEY, body: { glyphname: target.author_handle } });
  r = await j('/api/social?type=following', { token: KEY });
  ok(r.d.length === 0, 'unfollow works');

  // 11. block / unblock
  await j('/api/social?action=block', { method: 'POST', token: KEY, body: { glyphname: target.author_handle } });
  r = await j('/api/social?type=blocks', { token: KEY });
  ok(r.d.length === 1, 'block recorded');
  await j('/api/social?action=unblock', { method: 'DELETE', token: KEY, body: { glyphname: target.author_handle } });

  // 12. report
  r = await j('/api/social?action=report', { method: 'POST', token: KEY, body: { id: 'e2er' + Date.now(), kind: 'glyph', target_id: target.id, reason: 'test' } });
  ok(r.status === 200, `report accepted (${r.status})`);

  // 13. DM + conversation membership
  const me2 = (await j('/api/users')).d.find((u) => u.id === target.author);
  const conv = [uid, me2.id].sort().join('|');
  r = await j('/api/messages', { method: 'POST', token: KEY, body: { id: 'e2em' + Date.now(), conv, text: 'e2e dm' } });
  ok(r.status === 200, `message sent (${r.status})`);
  r = await j('/api/messages?conv=' + encodeURIComponent(conv), { token: KEY });
  ok(r.d.length === 1 && r.d[0].sender === uid, 'conversation readable by participant');
  // a conversation between two *other* parties must not be readable
  const foreign = ['nobody-a-' + Date.now(), 'nobody-b-' + Date.now()].sort().join('|');
  r = await j('/api/messages?conv=' + encodeURIComponent(foreign), { token: KEY });
  ok(r.status === 403, `non-participant cannot read conversation (${r.status})`);

  // 14. live identity is token-derived
  r = await j(`/api/live?me=${target.author}&after=${Date.now() - 60000}`);
  ok(r.d.msgs.length === 0 && r.d.liked.length === 0, 'live ignores spoofed ?me= param');

  // 15. analytics
  await j('/api/events', { method: 'POST', token: KEY, body: { name: 'cast', meta: { kind: 'love' } } });
  r = await j('/api/events', { token: KEY });
  ok(r.status === 200 && r.d.totals && r.d.byName.length > 0, 'stats endpoint aggregates own events');
  ok(r.d.totals.casts === 1 && r.d.totals.followers === 0, 'stats totals correct');

  // 16. heartbeat requires token
  r = await j('/api/users', { method: 'POST', body: { hb: true, id: uid } });
  ok(r.status === 401, `unauthenticated heartbeat blocked (${r.status})`);
  r = await j('/api/users', { method: 'POST', token: KEY, body: { hb: true, id: me2.id } });
  ok(r.status === 401, 'heartbeat for another user blocked');

  // cleanup
  await j('/api/wall?id=' + WID, { method: 'DELETE', token: KEY });
  await j('/api/social?action=block', { method: 'POST', token: KEY, body: { glyphname: target.author_handle } });
  console.log('\ncleanup: cast removed; throwaway user + like + comment left in place (needs DB delete)');
  console.log('THROWAWAY_HANDLE=@' + HANDLE);
} catch (e) {
  console.log('ERROR', e);
  process.exit(1);
}
