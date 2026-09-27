// REST adapter for the Vercel + Neon deploy. Polling replaces websockets.
// Auth now uses account keys (magic strings). Token stored in localStorage.

const CONFIG_KEY = 'gliffon.backend';
const TOKEN_KEY = 'gliffon.token';
const UID_KEY = 'gliffon.uid';

export const getBackendConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveBackendConfig = (base) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: base.trim().replace(/\/+$/, '') }));
};

export const clearBackendConfig = () => localStorage.removeItem(CONFIG_KEY);

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch { return null; }
};

export const saveToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(UID_KEY);
};

// The authenticated user id, persisted so a page reload keeps working
// before the session round-trip resolves.
let myUserId = (() => {
  try { return localStorage.getItem(UID_KEY); } catch { return null; }
})();
const setMyUserId = (id) => {
  myUserId = id || null;
  try {
    if (id) localStorage.setItem(UID_KEY, id);
    else localStorage.removeItem(UID_KEY);
  } catch { /* storage unavailable */ }
};

let cfg = getBackendConfig();
const isLocal = /(localhost|127\.0\.0\.1)/.test(location.hostname);
if (!cfg && !isLocal) cfg = { url: '' };

function api(path) {
  return cfg.url.startsWith('http') ? cfg.url + path : location.origin + path;
}

async function j(path, opts = {}) {
  const headers = { 'content-type': 'application/json' };
  const tok = getToken();
  if (tok) headers['x-auth-token'] = tok;
  if (opts.headers) Object.assign(headers, opts.headers);

  const r = await fetch(api(path), { ...opts, headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || r.status);
  return d;
}

export const backend = cfg
  ? {
      online: true,
      // key-based signin
      async signIn(glyphname, key) {
        const { ok, user } = await j('/api/session', {
          method: 'POST',
          body: JSON.stringify({ glyphname, key })
        });
        if (ok && user) {
          saveToken(key);
          setMyUserId(user.id);
          return user;
        }
        return null;
      },
      // signup: the account key is generated once and never sent to the server
      // in the clear (only its sha256 hash is stored).
      async signup(profile, key) {
        const { ok, user } = await j('/api/users', {
          method: 'POST',
          body: JSON.stringify({ ...profile, key })
        });
        if (ok && user) {
          saveToken(key);
          setMyUserId(user.id);
          return user;
        }
        throw new Error('signup failed');
      },
      // exchange the stored key for the current user profile
      async sessionUser() {
        const tok = getToken();
        if (!tok) return null;
        try {
          const { ok, user } = await j('/api/session', {
            method: 'POST',
            body: JSON.stringify({ key: tok })
          });
          if (ok && user) { setMyUserId(user.id); return user; }
          return null;
        } catch { return null; }
      },
      async listUsers() {
        const rows = await j('/api/users');
        return rows.map((r) => ({ ...r, glyphname: r.glyphname }));
      },
      async listWall() {
        return await j('/api/wall');
      },
      async addToWall(g) {
        await j('/api/wall', { method: 'POST', body: JSON.stringify(g) });
      },
      async likeWall(id) {
        await j('/api/wall?action=like', { method: 'POST', body: JSON.stringify({ wall_id: id }) });
      },
      async removeWall(id) {
        await j('/api/wall?id=' + id, { method: 'DELETE' });
      },
      convKey(friendId) {
        return [myUserId, friendId].filter(Boolean).sort().join('|');
      },
      listMessages(friendId) {
        return j('/api/messages?conv=' + encodeURIComponent(this.convKey(friendId)));
      },
      async sendMessage(friendId, text) {
        await j('/api/messages', {
          method: 'POST',
          body: JSON.stringify({
            id: crypto.randomUUID ? crypto.randomUUID() : uid2(),
            conv: this.convKey(friendId),
            text
          })
        });
      },
      findUser: async (glyphname) => {
        const want = String(glyphname || '').trim().replace(/^@/, '').toLowerCase();
        if (!want) return null;
        const rows = await j('/api/users');
        return rows.find((r) => String(r.glyphname || '').replace(/^@/, '').toLowerCase() === want) || null;
      },
      async heartbeat() {
        if (!myUserId) return;
        await j('/api/users', { method: 'POST', body: JSON.stringify({ hb: true, id: myUserId }) });
      },
      live(after) {
        return j('/api/live?after=' + after);
      },
      // comments
      async listComments(wallId) {
        return await j('/api/comments?wall_id=' + encodeURIComponent(wallId));
      },
      async addComment(wallId, text) {
        await j('/api/comments?wall_id=' + encodeURIComponent(wallId), {
          method: 'POST',
          body: JSON.stringify({ id: crypto.randomUUID ? crypto.randomUUID() : uid2(), text })
        });
      },
      // follows / blocks / reports  ->  /api/social
      async listFollows(type = 'following') {
        return await j('/api/social?type=' + type);
      },
      async follow(glyphname) {
        await j('/api/social?action=follow', { method: 'POST', body: JSON.stringify({ glyphname }) });
      },
      async unfollow(glyphname) {
        await j('/api/social?action=unfollow', { method: 'DELETE', body: JSON.stringify({ glyphname }) });
      },
      async listBlocks() {
        return await j('/api/social?type=blocks');
      },
      async block(glyphname) {
        await j('/api/social?action=block', { method: 'POST', body: JSON.stringify({ glyphname }) });
      },
      async unblock(glyphname) {
        await j('/api/social?action=unblock', { method: 'DELETE', body: JSON.stringify({ glyphname }) });
      },
      async report(kind, targetId, reason = '') {
        await j('/api/social?action=report', {
          method: 'POST',
          body: JSON.stringify({ id: uid2(), kind, target_id: targetId, reason })
        });
      },
      // events
      async event(name, meta = {}) {
        await j('/api/events', { method: 'POST', body: JSON.stringify({ name, meta }) });
      },
      async stats() {
        return await j('/api/events');
      },
      // push subs
      async pushSubscribe(sub) {
        await j('/api/push', { method: 'POST', body: JSON.stringify(sub) });
      },
      async pushUnsubscribe(endpoint) {
        await j('/api/push', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
      },
      async pushTest(title, body) {
        await j('/api/push?action=test', { method: 'POST', body: JSON.stringify({ title, body }) });
      },
      signOut() {
        clearToken();
      }
    }
  : null;

// tiny uid fallback
function uid2() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const setMyId = (id) => setMyUserId(id);
export const getMyId = () => myUserId;

// Handles are stored in the DB with a leading "@", so display sites must not
// prepend another one. This is the single place that normalises it.
export const at = (handle, fallback = '') => {
  const s = String(handle || fallback || '').trim().replace(/^@+/, '');
  return s ? '@' + s : '';
};

export const getAuth = () => ({
  token: getToken(),
  isSignedIn: !!getToken(),
  userId: myUserId
});