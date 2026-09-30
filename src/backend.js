// REST adapter for the Vercel + Neon deploy. Polling replaces websockets.
// Auth is username + password. The password is the identity; each device
// stores only its own session token, so signing in elsewhere does not
// invalidate the devices you already have.

const CONFIG_KEY = 'gliffon.backend';
const TOKEN_KEY = 'gliffon.token';
const UID_KEY = 'gliffon.uid';
const SESSION_KEY = 'gliffon.session';

export const getBackendConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw === 'offline') return { offline: true };
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveBackendConfig = (base) => {
  if (!base || !base.trim()) localStorage.setItem(CONFIG_KEY, 'offline');
  else localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: base.trim().replace(/\/+$/, '') }));
};

export const clearBackendConfig = () => localStorage.removeItem(CONFIG_KEY);

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch { return null; }
};

export const saveToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const saveSessionId = (s) => {
  try { if (s) localStorage.setItem(SESSION_KEY, s); else localStorage.removeItem(SESSION_KEY); } catch {}
};
export const getSessionId = () => {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
};
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(UID_KEY);
  localStorage.removeItem(SESSION_KEY);
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

// The live backend. On localhost we default to the deployed API so local dev
// shows the real community instead of an empty offline sandbox.
const PROD_API = 'https://gliffon.vercel.app';

let cfg = getBackendConfig();
const isLocal = /(localhost|127\.0\.0\.1)/.test(location.hostname);
if (!cfg || cfg.offline) {
  cfg = cfg && cfg.offline ? null : (isLocal ? { url: PROD_API } : { url: '' });
}

function api(path) {
  return cfg.url.startsWith('http') ? cfg.url + path : location.origin + path;
}

async function j(path, opts = {}) {
  const headers = { 'content-type': 'application/json' };
  const tok = getToken();
  if (tok) headers['x-auth-token'] = tok;
  if (opts.headers) Object.assign(headers, opts.headers);

  const r = await fetch(api(path), { ...opts, headers });
  const d = await r.json().catch(() => {
    // A non-JSON response means we hit the SPA shell instead of an API route
    // (e.g. pointing at a preview without serverless functions). Surface that
    // clearly rather than failing with a cryptic "Unexpected token <".
    throw new Error('That address is not a Gliffon API (it served the web page)');
  });
  if (!r.ok || d.error) throw new Error(d.error || r.status);
  return d;
}

// Probe once at boot: if the configured backend cannot serve the API, fall
// back to offline mode instead of leaving the app half-working.
export const backendReachable = async () => {
  try {
    const r = await fetch(api('/api/users'));
    return r.ok && (r.headers.get('content-type') || '').includes('json');
  } catch {
    return false;
  }
};

// A human-friendly device name so "your devices" is understandable later.
function deviceLabel() {
  try {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android phone' : 'Android tablet';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Linux/i.test(ua)) return 'Linux';
  } catch { /* ignore */ }
  return 'this device';
}

export const backend = cfg
  ? {
      online: true,

      // Sign in with username + password. The server issues a session token
      // for THIS device; other devices keep their own.
      async signIn(username, password) {
        const d = await j('/api/auth?action=login', {
          method: 'POST',
          body: JSON.stringify({ username, password, label: deviceLabel() })
        });
        if (d.ok && d.token && d.user) {
          saveToken(d.token);
          saveSessionId(d.session_id);
          setMyUserId(d.user.id);
          return d.user;
        }
        return null;
      },

      // Create an account. The password never touches storage on this device —
      // it goes straight to the server, which stores only a salted scrypt hash.
      async signup({ username, password, name, symbol }) {
        const d = await j('/api/auth?action=signup', {
          method: 'POST',
          body: JSON.stringify({ username, password, name, symbol, label: deviceLabel() })
        });
        if (d.ok && d.token && d.user) {
          saveToken(d.token);
          saveSessionId(d.session_id);
          setMyUserId(d.user.id);
          return d.user;
        }
        throw new Error(d.error || 'signup failed');
      },

      // Resolve the signed-in user from this device's session token.
      async sessionUser() {
        const tok = getToken();
        if (!tok) return null;
        try {
          const d = await j('/api/auth?action=me');
          if (d.ok && d.user) { setMyUserId(d.user.id); return d.user; }
          return null;
        } catch { return null; }
      },

      // Set a password (first time) or change it (needs the current one).
      async setPassword(current, password) {
        return await j('/api/auth?action=password', {
          method: 'POST',
          body: JSON.stringify({ current, password })
        });
      },

      async devices() {
        return await j('/api/auth?action=devices');
      },

      async revokeDevice(sessionId) {
        return await j('/api/auth?action=revoke', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId })
        });
      },

      async hasPassword() {
        const u = await j('/api/auth?action=me');
        return { id: u.user.id, has_password: true };
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
        return await j('/api/wall?action=like', {
          method: 'POST',
          body: JSON.stringify({ wall_id: id })
        });
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
      // Signs out THIS device only. Other devices stay signed in.
      async signOut() {
        try { await j('/api/auth?action=logout', { method: 'POST', body: '{}' }); } catch {}
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