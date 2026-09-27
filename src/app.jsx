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
import { backend, getBackendConfig, getAuth, setMyId, getMyId } from './backend.js';

const convOpen = (conv, openId) => openId && conv.split('|').includes(openId);

// Public glyph page at /g/:id — renders a shareable card with OG meta,
// and swaps in the real title/description so link previews look right.
function PublicGlyph({ glyphId }) {
  const [g, setG] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rows = await backend.listWall();
        const row = rows.find((r) => r.id === glyphId);
        if (!row) { setNotFound(true); return; }
        const who = row.author_name || row.author_handle || 'someone';
        document.title = `${row.label || 'A glyph'} — ${who} on Gliffon`;
        setMeta('og:title', `${row.symbol} ${row.label || 'A glyph'}`);
        setMeta('og:description', `${who} cast this glyph on Gliffon`);
        setMeta('og:url', location.origin + '/g/' + glyphId);
        setG(row);
      } catch { setNotFound(true); }
    })();
  }, [glyphId]);

  if (notFound) {
    return h('div', { class: 'publicglyph' },
      h('p', { class: 'sub' }, 'This glyph is no longer available.'),
      h('a', { class: 'btn primary', href: '/' }, 'Open Gliffon')
    );
  }
  if (!g) return h('div', { class: 'boot' }, h('span', { class: 'preview-glyph glow' }, '◆'));

  const who = g.author_name || g.author_handle || 'someone';
  return h('div', { class: 'publicglyph' },
    h('div', { class: 'card pgcard' },
      h('span', { class: 'preview-glyph glow' }, g.symbol),
      h('h2', null, g.label || 'A glyph'),
      g.note ? h('p', { class: 'sub' }, g.note) : null,
      h('p', { class: 'pgwho' }, `${g.author_symbol || '✦'} ${who}`),
      h('p', { class: 'sub' }, `${g.likes || 0} likes`),
      h('a', { class: 'btn primary', href: '/' }, 'Cast yours on Gliffon ✦')
    )
  );
}

function setMeta(property, content) {
  let el = document.head.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

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
  const [unread, setUnread] = useState(0);
  const [onlineIds, setOnlineIds] = useState({});
  const [following, setFollowing] = useState(new Set());
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [activity, setActivity] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(null);
  const [comments, setComments] = useState({});
  const [feedFilter, setFeedFilter] = useState('all'); // 'all' | 'following'
  const openRef = useRef(null);
  openRef.current = openChat;
  const prevLikes = useRef({});
  const prevWallKey = useRef('');
  const msgCursor = useRef(Date.now() - 60000);
  const commentCursors = useRef({});

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const pushActivity = (text, created) => {
    setActivity((list) => [{ text, created: created ? new Date(created).getTime() : Date.now() }, ...list].slice(0, 60));
  };

  // /g/:id renders the public share card instead of the app shell
  const glyphId = (location.pathname.match(/^\/g\/([\w-]+)/) || [])[1];
  if (glyphId) return h(PublicGlyph, { glyphId });

  const refresh = async () => {
    if (backendOK && backend) {
      const [wall, users, follows, blocks] = await Promise.all([
        backend.listWall(),
        backend.listUsers(),
        backend.listFollows('following'),
        backend.listBlocks()
      ]);
      setFollowing(new Set(follows.map((f) => f.id)));
      setBlockedUsers(blocks);
      const blocked = new Set(blocks.map((b) => b.id));
      const who = {};
      users.forEach((u) => { who[u.id] = u; });
      setContacts(users.filter((u) => u.id !== getMyId() && !blocked.has(u.id)));
      setGlyphs(wall.map((r) => ({
        id: r.id, kind: r.kind, symbol: r.symbol, label: r.label,
        note: r.note || undefined, likes: r.likes || 0,
        created: new Date(r.created).getTime(),
        who: {
          name: (who[r.author] || {}).name || (who[r.author] || {}).glyphname || 'unknown',
          glyphname: (who[r.author] || {}).glyphname || '',
          symbol: (who[r.author] || {}).symbol || '✦',
          rid: r.author
        }
      })));
    } else {
      setGlyphs(await store.listGlyphs());
      setContacts(await store.listContacts());
    }
  };

  useEffect(() => {
    (async () => {
      // If a token exists, resolve the real user id for conv keys and ownership
      if (backendOK && backend) {
        const { token } = getAuth();
        if (token) {
          try {
            const u = await backend.sessionUser();
            if (u) setMyId(u.id);
          } catch {}
        }
      }
      setProfile(await store.getProfile());
      setReady(true);
      remind.schedule();
      if (backendOK && backend && getAuth().token) {
        await refresh();
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setPushEnabled(!!sub);
        } catch {}
      }
    })();
  }, []);

  useEffect(() => {
    if (!profile || !backendOK) return;
    if (!backend || !getAuth().token) {
      (async () => {
        await store.clearProfile();
        setProfile(undefined);
      })();
    }
  }, [profile, backendOK]);

  async function subscribePush(reg) {
    try {
      const vapidPublic = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9vvmcNWPA6kf4mr6VkGrsKDESu1Krs/hrbpR5ES9MyBhnQss4kGrJJhV/QbQS67AAkRu/swfZDBksJEuCZwUrw==';
      const key = urlBase64ToUint8Array(vapidPublic);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });
      await backend.pushSubscribe(sub.toJSON());
      setPushEnabled(true);
      notify('Push notifications on');
    } catch (e) {
      console.warn('push subscribe failed', e);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  // the realtime engine: deltas every 2.5s — likes, new casts, DMs, comments, follows, presence
  useEffect(() => {
    if (!profile || !backendOK || !backend) return;
    let alive = true;
    (async () => {
      try { await refresh(); } catch (e) { notify('Backend: ' + e.message); }
    })();

    const tick = setInterval(async () => {
      if (document.visibilityState === 'hidden' || !alive || !backend) return;
      try {
        backend.heartbeat();
        const meId = getMyId();
        if (!meId) return;
        const d = await backend.live(msgCursor.current);
        msgCursor.current = Date.now() - 1000;

        // DMs
        if (d.msgs && d.msgs.length) {
          for (const m of d.msgs) {
            const opened = convOpen(m.conv, openRef.current);
            if (!opened) {
              setUnread((n) => n + 1);
              notify(`${m.sender_handle || '@' + (m.sender_name || 'someone')} · ${m.sender_name || 'someone'}: ${m.text.slice(0, 34)}`);
            }
          }
          setLiveMsg(d);
        }

        // Wall (new casts/removed casts/likes)
        const wallKey = d.wall.map((r) => `${r.id}:${r.likes}`).join(',') + `#${d.wall.length}`;
        if (wallKey !== prevWallKey.current) {
          const likedIds = new Set((d.liked || []).map((l) => l.wall_id));
          for (const l of d.liked || []) {
            const who = l.liker_handle || '@' + (l.liker_name || 'someone');
            const whoName = l.liker_name && l.liker_name !== l.liker_handle ? ` (${l.liker_name})` : '';
            notify(`${l.liker_symbol || '♥'} ${who}${whoName} liked your glyph "${l.glyph_label}"`);
            pushActivity(`${l.liker_handle} liked "${l.glyph_label}"`, l.created);
          }
          for (const row of d.wall) {
            if ((prevLikes.current[row.id] || 0) < (row.likes || 0) && row.author === meId && !likedIds.has(row.id)) {
              notify('♥ your glyph was liked');
              break;
            }
          }
          prevLikes.current = Object.fromEntries(d.wall.map((r) => [r.id, r.likes || 0]));
          prevWallKey.current = wallKey;
          setGlyphs(d.wall.map((r) => ({
            id: r.id, kind: r.kind, symbol: r.symbol, label: r.label,
            note: r.note || undefined, likes: r.likes || 0,
            created: new Date(r.created).getTime(),
            who: {
              name: r.author_name || r.author_handle || 'unknown',
              glyphname: r.author_handle || '',
              symbol: r.author_symbol || '✦',
              rid: r.author
            }
          })));
        } else {
          prevLikes.current = Object.fromEntries(d.wall.map((r) => [r.id, r.likes || 0]));
        }

        // Comments on my glyphs
        if (d.commented && d.commented.length) {
          for (const c of d.commented) {
            const key = c.wall_id + '|' + c.created;
            if (!commentCursors.current[key]) {
              commentCursors.current[key] = true;
              notify(`${c.commenter_handle || '@' + c.commenter_name} commented on "${c.glyph_label}": ${c.comment_text.slice(0, 40)}`);
              pushActivity(`${c.commenter_handle} commented on "${c.glyph_label}"`, c.created);
            }
          }
        }

        // Presence
        if (d.online) {
          const map = {};
          d.online.forEach((p) => (map[p.id] = true));
          setOnlineIds(map);
        }
      } catch {}
    }, 2500);

    return () => { alive = false; clearInterval(tick); };
  }, [profile, backendOK]);

  const like = async (g) => {
    setGlyphs((list) => list.map((x) => (x.id === g.id ? { ...x, likes: (x.likes || 0) + 1 } : x)));
    if (backendOK && backend) {
      await backend.likeWall(g.id);
      event('like', { glyphId: g.id });
    } else {
      await store.like(g.id);
    }
  };

  const openComments = async (g) => {
    if (commentsOpen === g.id) { setCommentsOpen(null); return; }
    setCommentsOpen(g.id);
    if (backendOK && backend) {
      const cs = await backend.listComments(g.id);
      setComments((prev) => ({ ...prev, [g.id]: cs }));
    }
  };

  const addComment = async (g, text) => {
    if (!text.trim()) return;
    if (backendOK && backend) {
      await backend.addComment(g.id, text);
      const cs = await backend.listComments(g.id);
      setComments((prev) => ({ ...prev, [g.id]: cs }));
    }
  };

  const toggleFollow = async (u) => {
    if (following.has(u.id)) {
      await backend.unfollow(u.glyphname);
      setFollowing((s) => { const n = new Set(s); n.delete(u.id); return n; });
      notify(`Unfollowed @${u.glyphname}`);
    } else {
      await backend.follow(u.glyphname);
      setFollowing((s) => { const n = new Set(s); n.add(u.id); return n; });
      notify(`Followed @${u.glyphname}`);
    }
  };

  const blockUser = async (u) => {
    await backend.block(u.glyphname);
    await refresh();
    notify(`Blocked @${u.glyphname}`);
  };

  const unblockUser = async (u) => {
    await backend.unblock(u.glyphname);
    await refresh();
    notify(`Unblocked @${u.glyphname}`);
  };

  const reportGlyph = async (g, reason) => {
    await backend.report('glyph', g.id, reason);
    notify('Reported — thank you');
  };

  const reportUser = async (u, reason) => {
    await backend.report('user', u.id, reason);
    notify('Reported — thank you');
  };

  const signOut = async () => {
    if (backendOK && backend) backend.signOut();
    await store.clearProfile();
    setProfile(undefined);
    setGlyphs([]);
    setCommentsOpen(null);
    notify('Signed out');
  };

  const event = (name, meta = {}) => {
    if (backendOK && backend) backend.event(name, meta).catch(() => {});
  };

  if (!ready) {
    return h('div', { class: 'boot' }, h('span', { class: 'preview-glyph glow' }, '◆'));
  }

  if (!profile) {
    return h(Auth, {
      connected: backendOK,
      onSignUp: async (p, key) => {
        if (backendOK && backend) await backend.signup(p, key);
        await store.saveProfile(p);
        setProfile(p);
        notify('Welcome to Gliffon ✦');
        refresh();
      },
      onSignIn: async (handle, key) => {
        if (backendOK && backend) {
          const u = await backend.signIn(handle, key);
          if (!u) throw new Error('wrong glyph name or account key — create an account');
          await store.saveProfile({
            name: u.name,
            glyphName: u.glyphname,
            symbol: u.symbol,
            joined: new Date().getTime()
          });
          setProfile({
            name: u.name,
            glyphName: u.glyphname,
            symbol: u.symbol,
            joined: new Date().getTime()
          });
          notify(`Signed in as ${u.glyphname} ✦`);
          refresh();
        } else {
          const p = { name: handle, glyphName: handle, symbol: '✦', joined: Date.now() };
          await store.saveProfile(p);
          setProfile(p);
          notify('Pinned locally ✓ (connect for the global Wall)');
        }
      }
    });
  }

  const filteredGlyphs = feedFilter === 'following'
    ? glyphs.filter((g) => following.has(g.who.rid))
    : glyphs;

  return h('div', { id: 'app' },
    h('header', { class: 'appbar' },
      h('span', { class: 'brand', onClick: () => setTab('reels') }, 'Gliffon'),
      backendOK && h('span', { class: 'live-indicator' }, 'live'),
      h('div', { class: 'tabs' },
        ['reels', 'glyphs', 'chats', 'pulse', 'profile'].map((t) =>
          h('button', {
            key: t, class: 'tab' + (tab === t ? ' on' : ''),
            onClick: () => { setTab(t); setUnread(0); }
          }, t.charAt(0).toUpperCase() + t.slice(1))
        )
      ),
      h('div', { class: 'header-actions' },
        h('button', { class: 'iconbtn', onClick: () => setFeedFilter((f) => f === 'all' ? 'following' : 'all') },
          feedFilter === 'following' ? '⧉ Following' : '⬤ All'
        ),
        h('button', { class: 'iconbtn', onClick: () => setTab('composer') }, '✦'),
        h('button', { class: 'iconbtn', onClick: signOut }, '⏻')
      )
    ),

    toast && h('div', { class: 'toast', onClick: () => setToast('') }, toast),

    tab === 'reels' && h(Reels, {
      glyphs: filteredGlyphs, like, onShare: (g) => setShareTarget(g),
      openComments, comments, addComment, commentsOpen,
      onlineIds, meId: getMyId(), profile, following, toggleFollow, blockUser,
      reportGlyph, reportUser, event
    }),

    tab === 'glyphs' && h(Composer, {
      profile, onSave: async (g) => {
        if (backendOK && backend) {
          await backend.addToWall(g);
          event('cast', { kind: g.kind });
          notify('Glyph cast ✓');
        } else {
          await store.addGlyph(g);
          notify('Pinned locally ✓ (connect for the global Wall)');
        }
        setTab('reels');
        refresh();
      }
    }),

    tab === 'chats' && h(Chats, {
      profile, contacts, openChat, setOpenChat, unread, setUnread,
      liveMsg, setLiveMsg, backendOK, backend, event
    }),

    tab === 'pulse' && h(Pulse, {
      profile, glyphs, contacts, onlineIds, activity, setActivity,
      following, blockedUsers, toggleFollow, blockUser, unblockUser,
      backendOK, backend, event, pushEnabled, setPushEnabled, subscribePush
    }),
    tab === 'profile' && h('main', { class: 'profileview' },
      h('div', { class: 'profilecard' },
        h('span', { class: 'avatar glow pfsym' }, profile.symbol),
        h('h2', null, profile.name),
        h('div', { class: 'gname' }, profile.glyphName),
        h('p', { class: 'sub' }, `Joined ${new Date(profile.joined).toLocaleDateString()}`),
        h('div', { class: 'statrow' },
          h('div', { class: 'stat' }, h('span', null, glyphs.length), h('small', null, 'casts')),
          h('div', { class: 'stat' }, h('span', null, following.size), h('small', null, 'following')),
          h('div', { class: 'stat' }, h('span', null, contacts.length), h('small', null, 'contacts'))
        )
      ),
      h('details', { class: 'settings' },
        h('summary', null, 'Settings'),
h('label', null, 'Reminders', h('select', {
          value: remindState, onChange: (e) => { remind.set(e.target.value); setRemindState(e.target.value); }
        }, ['off', 'gentle', 'daily'].map((v) => h('option', { value: v }, v)))),
        h('span', { class: 'push-status' }, pushEnabled ? 'Push: ON' : 'Push: OFF'),
        h('button', { class: 'btn ghost tiny', onClick: async () => {
          if (pushEnabled) {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) { await sub.unsubscribe(); await backend.pushUnsubscribe(sub.endpoint); setPushEnabled(false); }
          } else {
            const reg = await navigator.serviceWorker.ready;
            await subscribePush(reg);
          }
        }}, pushEnabled ? 'Disable' : 'Enable'),
        h('details', null,
          h('summary', null, 'Blocked'),
          blockedUsers.length === 0
            ? h('p', { class: 'sub' }, 'Nobody blocked')
            : blockedUsers.map((u) =>
                h('div', { class: 'blocked-item', key: u.id },
                  h('span', { class: 'avatar' }, u.symbol),
                  h('span', null, '@' + u.glyphname),
                  h('button', { class: 'btn ghost', onClick: () => unblockUser(u) }, 'Unblock')
                )
              )
        )
      )
    ),

    h('footer', { class: 'bottombar' },
      ['reels', 'glyphs', 'chats', 'pulse', 'profile'].map((t) =>
        h('button', {
          key: t, class: 'bbtab' + (tab === t ? ' on' : ''),
          onClick: () => { setTab(t); setUnread(0); }
        },
          t === 'reels' ? '⬤' :
          t === 'glyphs' ? '✦' :
          t === 'chats' ? '☗' + (unread ? ' ' + unread : '') :
          t === 'pulse' ? '⚡' :
          '◈')
      )
    ),

    shareTarget && h(ShareSheet, {
      glyph: shareTarget,
      contacts,
      onSendToContact: async (c) => {
        if (backendOK && backend) {
          await backend.sendMessage(c.id, glyphCard(shareTarget));
        } else {
          await store.addMessage({ id: uid(), contactId: c.id, from: 'me', text: glyphCard(shareTarget), created: Date.now() });
        }
        setShareTarget(null);
        setOpenChat(c.id);
        setTab('chats');
        notify('Shared to ' + c.name);
      },
      onCastToWall: async () => {
        await backend.addToWall({ ...shareTarget, id: uid() });
        setShareTarget(null);
        refresh();
        notify('Cast to the Wall ✓');
      },
      onClose: () => setShareTarget(null)
    })
  );
}