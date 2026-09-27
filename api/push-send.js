import { conn, bind, json, readBody, authUser, rate } from './_db.js';
import { sendToUser } from './_push.js';

// Sends a web-push notification to a target user (used by the live engine and moderation).
export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);
  if (req.method !== 'POST') return json(res, { error: 'method' }, 405);
  if (!rate(req, res, { key: 'push', max: 30, windowMs: 60000 })) return;

  const b = await readBody(req);
  if (!b.user_id) return json(res, { error: 'user_id required' }, 400);

  const sent = await sendToUser(sql, b.user_id, {
    title: b.title || 'Gliffon',
    body: b.body || 'New activity on your wall',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: b.data || {}
  });
  return json(res, { ok: true, sent });
});
