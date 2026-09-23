// REST adapter for the Vercel + Neon deploy. Polling replaces websockets.
// Fallback: pure-local IndexedDB adapter when not configured.

const CONFIG_KEY = 'gliffon.backend';

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

let cfg = getBackendConfig();
// Online social app: on any real deployment, go live by default (same-origin API).
const isLocal = /(localhost|127\.0\.0\.1)/.test(location.hostname);
if (!cfg && !isLocal) cfg = { url: '' };

function api(path) {
  return cfg.url.startsWith('http') ? cfg.url + path : location.origin + path;
}

async function j(path, opts) {
  const r = await fetch(api(path), {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts?.headers || {}) }
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || r.status);
  return d;
}

export const me = { id: null };
try { me.id = JSON.parse(localStorage.getItem('gliffon.me')); } catch { me.id = null; }

export const backend = cfg
  ? {
      online: true,
      async signIn(glyphname) {
        const rows = await j('/api/users');
        const u = rows.find(
          (r) => r.glyphname.toLowerCase() === glyphname.trim().toLowerCase()
        );
        if (!u) return null;
        me.id = u.id;
        localStorage.setItem('gliffon.me', JSON.stringify(u.id));
        return u;
      },
      async signup(profile) {
        const rows = await j('/api/users');
        const taken = rows.find(
          (r) => r.glyphname.toLowerCase() === profile.glyphName.trim().toLowerCase()
        );
        if (taken) throw new Error('that glyph name is taken');
        const user = {
          id: crypto.randomUUID ? crypto.randomUUID() : uid2(),
          glyphname: profile.glyphName.trim(),
          name: profile.name,
          symbol: profile.symbol || '✦'
        };
        await j('/api/users', { method: 'POST', body: JSON.stringify(user) });
        me.id = user.id;
        localStorage.setItem('gliffon.me', JSON.stringify(user.id));
        return user;
      },
      sessionUser() {
        if (!me.id) return null;
        return j('/api/users').then((rows) => rows.find((r) => r.id === me.id) || null);
      },
      async listUsers() {
        const rows = await j('/api/users');
        return rows.map((r) => ({ ...r, glyphname: r.glyphname }));
      },
      async listWall() {
        const rows = await j('/api/wall');
        return rows;
      },
      async addToWall(g) {
        await j('/api/wall', { method: 'POST', body: JSON.stringify({ ...g, author: me.id }) });
      },
      async likeWall(id) {
        await j('/api/wall?id=' + id, { method: 'PATCH' });
      },
      async removeWall(id) {
        await j('/api/wall?id=' + id, { method: 'DELETE' });
      },
      convKey(friendId) {
        return [me.id, friendId].sort().join('|');
      },
      listMessages(friendId) {
        return j('/api/messages?conv=' + encodeURIComponent(this.convKey(friendId)));
      },
      async sendMessage(friendId, text) {
        await j('/api/messages', {
          method: 'POST',
          body: JSON.stringify({
            id: crypto.randomUUID ? crypto.randomUUID() : uid2(),
            conv: this.convKey(friendId), sender: me.id, text
          })
        });
      },
      findUser: async (glyphname) =>
        (await j('/api/users')).find((r) => r.glyphname === glyphname) || null,
      async heartbeat() {
        if (!me.id) return;
        await j('/api/users', { method: 'POST', body: JSON.stringify({ id: me.id, hb: true }) });
      },
      live(meId, after) {
        return j('/api/live?me=' + encodeURIComponent(meId) + '&after=' + after);
      }
    }
  : null;

export const myId = () => me.id;
const uid2 = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
