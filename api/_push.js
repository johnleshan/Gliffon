import webpush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const SUBJECT = 'mailto:gliffon@vercel.app';

// Set once at module load; web-push handles VAPID JWT + payload encryption (aes128gcm).
let configured = false;
function ensure() {
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  }
}

export async function sendPush(subscription, payload) {
  ensure();
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 86400 });
}

export async function sendToUser(sql, userId, payload) {
  const subs = await sql`select endpoint, p256dh, auth from push_subs where user_id = ${userId}`;
  let sent = 0;
  for (const s of subs) {
    try {
      await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (e) {
      // 404/410 mean the browser dropped the subscription — clean it up
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        await sql`delete from push_subs where user_id = ${userId} and endpoint = ${s.endpoint}`;
      }
    }
  }
  return sent;
}
