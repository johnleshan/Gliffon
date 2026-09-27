// REST adapter for the Vercel + Neon deploy. Polling replaces websockets.
// Auth now uses account keys (magic strings). Token stored in localStorage.

const CONFIG_KEY = 'gliffon.backend';
const TOKEN_KEY = 'gliffon.token';

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
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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
      // key-based signin (legacy accounts claim their key on first use)
      async signIn(glyphname, key) {
        const { ok, user } = await j('/api/session', {
          method: 'POST',
          body: JSON.stringify({ glyphname, key })
        });
        if (ok && user) {
          saveToken(key);
          myUserId = user.id;
          return user;
        }
        return null;
      },
      // signup: generates a new key for the user
      async signup(profile, key) {
        const { ok, name } = await j('/api/users', {
          method: 'POST',
          body: JSON.stringify({ ...profile, key })
        });
        if (ok) {
          saveToken(key);
          return { name };
        }
        throw new Error('signup failed');
      },
      // exchange token for current user profile
      async sessionUser() {
        const tok = getToken();
        if (!tok) return null;
        try {
          const { ok, user } = await j('/api/session', {
            method: 'POST',
            body: JSON.stringify({ glyphname: '', key: tok })
          });
          if (ok && user) { myUserId = user.id; return user; }
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
        await j('/api/like', { method: 'POST', body: JSON.stringify({ wall_id: id }) });
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
      findUser: async (glyphname) =>
        (await j('/api/users')).find((r) => r.glyphname === glyphname) || null,
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
      // follows
      async listFollows(type = 'following') {
        return await j('/api/follows?type=' + type);
      },
      async follow(glyphname) {
        await j('/api/follows', { method: 'POST', body: JSON.stringify({ glyphname }) });
      },
      async unfollow(glyphname) {
        await j('/api/follows', { method: 'DELETE', body: JSON.stringify({ glyphname }) });
      },
      // blocks
      async listBlocks() {
        return await j('/api/blocks');
      },
      async block(glyphname) {
        await j('/api/blocks', { method: 'POST', body: JSON.stringify({ glyphname }) });
      },
      async unblock(glyphname) {
        await j('/api/blocks', { method: 'DELETE', body: JSON.stringify({ glyphname }) });
      },
      // reports
      async report(kind, targetId, reason = '') {
        await j('/api/reports', { method: 'POST', body: JSON.stringify({ id: uid(), kind, target_id: targetId, reason }) });
      },
      // events
      async event(name, meta = {}) {
        await j('/api/events', { method: 'POST', body: JSON.stringify({ name, meta }) });
      },
      // push subs
      async pushSubscribe(sub) {
        await j('/api/push-subs', { method: 'POST', body: JSON.stringify(sub) });
      },
      async pushUnsubscribe(endpoint) {
        await j('/api/push-subs', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
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

let myUserId = null;
export const setMyId = (id) => { myUserId = id; };
export const getMyId = () => myUserId;

export const getAuth = () => ({
  token: getToken(),
  isSignedIn: !!getToken(),
  userId: myUserId
});