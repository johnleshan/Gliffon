import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { store, KINDS, uid } from './store.js';
import { Composer } from './composer.jsx';
import { Auth } from './auth.jsx';
import { remind, glyphCard } from './share.js';
import { Pulse } from './pulse.jsx';
import { Reels } from './reels.jsx';
import { Chats } from './chats.jsx';
import { ShareSheet } from './share.jsx';
import { ConnectSheet } from './connect.jsx';
import { backend, getBackendConfig, myId } from './backend.js';

const postLike = (wallId, userId) =>
  fetch('/api/like', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wall_id: wallId, user_id: userId })
  }).then((r) => r.json());

const convOpen = (conv, openId) => openId && conv.split('|').includes(openId);

export function App() {
  const [profile, setProfile] = useState(undefined);
  const [glyphs, setGlyphs] = useState([]);
  const [tab, setTab] = useState('reels');
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const [remindState, setRemindState] = useState(() => remind.status());
  const [openChat, setOpenChat] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [backendOK, setBackendOK] = useState(
    () => !!getBackendConfig() || !/(localhost|127\.0\.0\.1)/.test(location.hostname)
  );
  const [liveMsg, setLiveMsg] = useState(null);
  const [connect, setConnect] = useState(false);
  const [unread, setUnread] = useState(0);
  const [onlineIds, setOnlineIds] = useState({});
  const openRef = useRef(null);
  openRef.current = openChat;
  const prevLikes = useRef({});
  const prevWallKey = useRef('');
  const msgCursor = useRef(Date.now() - 60000);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const refresh = async () => {
    if (backendOK && backend) {
      const [wall, users] = await Promise.all([backend.listWall(), backend.listUsers()]);
      const who = {};
      users.forEach((u) => { who[u.id] = u; });
      setContacts(users.filter((u) => u.id !== myId()));
      setGlyphs(wall.map((r) => ({
        id: r.id, kind: r.kind, symbol: r.symbol, label: r.label,
        note: r.note || undefined, likes: r.likes || 0,
        created: new Date(r.created).getTime(),
        who: { name: (who[r.author] || {}).name || 'anon', symbol: (who[r.author] || {}).symbol || '✦', rid: r.author }
      })));
    } else {
      setGlyphs(await store.listGlyphs());
      setContacts(await store.listContacts());
    }
  };

  useEffect(() => {
    (async () => {
      setProfile(await store.getProfile());
      setReady(true);
      remind.schedule();
    })();
  }, []);

  // the realtime engine: deltas every 2.5s — likes, new casts, DMs, presence — no reloads
  useEffect(() => {
    if (!profile || !backendOK || !backend) return;
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        notify('Backend: ' + e.message);
      }
    })();

    const tick = setInterval(async () => {
      if (document.visibilityState === 'hidden' || !alive || !backend) return;
      try {
        backend.heartbeat();
        const meId = myId();
        if (!meId) return;
        const d = await backend.live(meId, msgCursor.current);
        msgCursor.current = Date.now() - 1000;

        // --- DMs, unread count, nudges ---
        if (d.msgs && d.msgs.length) {
          for (const m of d.msgs) {
            const opened = convOpen(m.conv, openRef.current);
            if (!opened) {
              setUnread((n) => n + 1);
              notify(`💬 ${m.sender_name || 'someone'}: ${m.text.slice(0, 34)}`);
            }
          }
          setLiveMsg(d);
        }

        // --- wall (new casts/removed casts/likes merged without scroll jumps) ---
        const wallKey = d.wall.map((r) => `${r.id}:${r.likes}`).join(',') + `#${d.wall.length}`;
        if (wallKey !== prevWallKey.current) {
          // who liked my glyph lately (name, not generic)
          const likedIds = new Set((d.liked || []).map((l) => l.wall_id));
          for (const l of d.liked || []) {
            notify(`♥ ${l.liker_name || 'someone'} (@${l.liker_handle}) liked "${l.glyph_label}"`);
          }

          for (const row of d.wall) {
            if ((prevLikes.current[row.id] || 0) < (row.likes || 0) && row.author === meId && !likedIds.has(row.id)) {
              notify('♥ someone liked your glyph');
              break;
            }
          }
          prevLikes.current = Object.fromEntries(d.wall.map((r) => [r.id, r.likes || 0]));
          prevWallKey.current = wallKey;
          setGlyphs(d.wall.map((r) => ({
            id: r.id, kind: r.kind, symbol: r.symbol, label: r.label,
            note: r.note || undefined, likes: r.likes || 0,
            created: new Date(r.created).getTime(),
            who: { name: r.author_name || 'anon', glyphname: r.author_handle || '', symbol: r.author_symbol || '✦', rid: r.author }
          })));
        } else {
          prevLikes.current = Object.fromEntries(d.wall.map((r) => [r.id, r.likes || 0]));
        }

        // --- presence dots ---
        if (d.online) {
          const map = {};
          d.online.forEach((p) => (map[p.id] = true));
          setOnlineIds(map);
        }
      } catch {}
    }, 2500);

    return () => { alive = false; clearInterval(tick); };
  }, [profile, backendOK]);

  if (!ready) {
    return h('div', { class: 'boot' }, h('span', { class: 'preview-glyph glow' }, '◆'));
  }

  if (!profile) {
    return h(Auth, {
      connected: backendOK,
      onSignUp: async (p) => {
        if (backendOK && backend) await backend.signup(p);
        await store.saveProfile(p);
        setProfile(p);
        notify('Welcome to Gliffon ✦');
        refresh();
      },
      onSignIn: async (handle) => {
        if (backendOK && backend) {
          const u = await backend.signIn(handle);
          if (!u) throw new Error('no account with that glyph name — create one');
          await store.saveProfile({
            name: u.name,
            glyphName: u.glyphname,
            symbol: u.symbol,
            joined: new Date(u.created || Date.now()).getTime()
          });
          setProfile({
            name: u.name,
            glyphName: u.glyphname,
            symbol: u.symbol,
            joined: new Date(u.created || Date.now()).getTime()
          });
          notify(`Signed in as ${u.glyphname} ✦`);
          refresh();
        } else {
          throw new Error('sign-in works online — localhost runs offline-only');
        }
      }
    });
  }

  const cast = async (draft) => {
    const g = { id: uid(), created: Date.now(), likes: 0, ...draft };
    try {
      if (backendOK && backend) {
        await backend.addToWall(g);
        await refresh();
      } else {
        await store.addGlyph(g);
        await refresh();
      }
      setTab('reels');
      notify('Glyph cast ✓');
    } catch (e) {
      notify('Cast failed: ' + e.message);
    }
  };

  const like = async (g) => {
    setGlyphs((list) => list.map((x) => (x.id === g.id ? { ...x, likes: (x.likes || 0) + 1 } : x)));
    if (backendOK && backend) {
      const meId = myId();
      if (meId) {
        await postLike(g.id, meId);
      } else {
        await backend.likeWall(g.id);
      }
    } else {
      await store.like(g.id);
    }
  };

  const removeGlyph = async (g) => {
    if (backendOK && backend) await backend.removeWall(g.id);
    else await store.deleteGlyph(g.id);
    await refresh();
  };

  const sendToContact = async (c) => {
    if (backendOK && backend) {
      await backend.sendMessage(c.id, glyphCard(shareTarget));
      setOpenChat(c.id);
      setTab('chats');
      notify(`Glyph opened as a message to ${c.name}`);
    } else {
      await store.addMessage({
        id: uid(), contactId: c.id, from: 'me', text: glyphCard(shareTarget), created: Date.now()
      });
      setOpenChat(c.id);
      setTab('chats');
    }
    setShareTarget(null);
  };

  const castToWall = async () => {
    const g = glyphs.find((x) => x.id === shareTarget.id);
    if (g) {
      if (backendOK && backend) await backend.addToWall(g);
      else {
        await store.deleteGlyph(g.id);
        await store.addGlyph({ ...g, wall: true });
      }
      await refresh();
    }
    setShareTarget(null);
    setTab('reels');
    notify(backendOK ? 'On the communal Wall ✓' : 'Pinned locally ✓ (connect for the global Wall)');
  };

  return h('div', { class: 'shell' },
        tab === 'glyphs' && h(Composer, { onGlyph: cast }),    tab === 'reels' && h(Reels, {
      glyphs, profile,
      onShare: setShareTarget,
      onRefresh: refresh,
      onLike: like,
      onRemove: removeGlyph
    }),
    tab === 'chats' && h(Chats, {
      openContactId: openChat,
      setOpenContactId: setOpenChat,
      refreshContacts: refresh,
      connected: backendOK,
      liveMsg,
      onlineIds,
      notify
    }),
    tab === 'pulse' && h(Pulse, { glyphs }),
    tab === 'profile' && h('section', { class: 'profile' },
      h('p', { class: 'eyebrow' }, 'Identity'),
      h('div', { class: 'card profilecard' },
        h('div', { class: 'profileaura', 'aria-hidden': 'true' }),
        h('span', { class: 'avatar glow pfsym' }, profile.symbol || profile.glyphName.slice(0, 1).toUpperCase()),
        h('h2', null, profile.name),
        h('p', { class: 'sub gname' }, `@${profile.glyphName}`),
        h('p', { class: 'sub' }, `since ${new Date(profile.joined).toLocaleDateString()} · ${glyphs.length} glyphs cast`)
      ),
      !backendOK
        ? h('button', { class: 'btn primary', onClick: () => setConnect(true) }, '🌐 Connect people (free)')
        : h('button', { class: 'btn primary', onClick: () => setConnect(true) }, '🌐 Neon: connected ✓'),
      h('button', {
        class: 'btn primary',
        onClick: async () => {
          if (remindState === 'on') {
            remind.disable(); setRemindState('off'); notify('Reminders off');
          } else {
            const r = await remind.enable();
            setRemindState(r);
            if (r === 'on') remind.schedule();
            else notify(r === 'denied' ? 'Permission denied' : 'Notifications unsupported');
          }
        }
      },
        remindState === 'on' ? 'Reminders: on' : 'Reminders: off'
      ),
      h('button', {
        class: 'btn ghost',
        onClick: async () => {
          await store.clearProfile();
          setProfile(undefined);
          setTab('reels');
          setUnread(0);
          setOpenChat(null);
          notify('Signed out');
        }
      }, 'Log out')
    ),
    h('nav', null,
      [
        ['reels', '▶', 'Reels'],
        ['glyphs', '✦', 'Cast'],
        ['chats', '💬', 'Chats'],
        ['pulse', '📈', 'Pulse'],
        ['profile', '☺', 'You']
      ].map(([t, icon, name]) =>
        h('button', {
          key: t,
          class: tab === t ? 'active' : '',
          onClick: () => { if (t === 'chats') setUnread(0); setTab(t); }
        },
          h('span', { class: 'navicon' }, icon),
          name,
          t === 'chats' && unread > 0 ? h('span', { class: 'badge' }, unread) : null
        )
      )
    ),
    shareTarget
      ? h(ShareSheet, {
          glyph: shareTarget,
          contacts,
          onSendToContact: sendToContact,
          onCastToWall: castToWall,
          onClose: () => setShareTarget(null)
        })
      : null,
    connect ? h(ConnectSheet, {
      connected: backendOK,
      onClose: () => setConnect(false),
      onSaved: () => location.reload()
    }) : null,
    h('div', { class: 'toast', role: 'status' }, toast)
  );
}
