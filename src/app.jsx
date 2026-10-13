import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { store, KINDS, uid } from './store.js';
import { Composer } from './composer.jsx';
import { Paint, PaintedGlyph } from './paint.jsx';
import { Auth } from './auth.jsx';
import { remind, glyphCard } from './share.js';
import { Pulse } from './pulse.jsx';
import { Reels } from './reels.jsx';
import { Chats } from './chats.jsx';
import { ShareSheet } from './share.jsx';
import { backend, getBackendConfig, getAuth, setMyId, getMyId, at, backendReachable } from './backend.js';

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
      g.svg ? h(PaintedGlyph, { svg: g.svg }) : h('span', { class: 'preview-glyph glow' }, g.symbol),
      h('h2', null, g.label || 'A glyph'),
      g.note ? h('p', { class: 'sub' }, g.note) : null,
      h('p', { class: 'pgwho' }, `${g.author_symbol || '✦'} ${who}`),
      h('p', { class: 'sub' }, `${g.likes || 0} likes`),
      h('a', { class: 'btn primary', href: '/' }, 'Cast yours on Gliffon ✦')
    )
  );
}

// Signed-in devices. Every device holds its own session, so this account can
// be open on a phone and a laptop at once — and you can kick any of them out.
function YourDevices() {
  const [devices, setDevices] = useState(null);
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try { setDevices(await backend.devices()); } catch { setDevices([]); }
  };
  useEffect(() => { load(); }, []);

  const rel = (t) => {
    const s = Math.max(1, Math.round((Date.now() - new Date(t).getTime()) / 60000));
    if (s < 60) return s + 'm ago';
    if (s < 1440) return Math.round(s / 60) + 'h ago';
    return Math.round(s / 1440) + 'd ago';
  };

  return h('div', { class: 'keyrow col' },
    h('div', { class: 'keyinfo' },
      h('b', null, 'Your devices'),
      h('span', { class: 'sub' }, 'signed in everywhere you use Gliffon')
    ),
    h('div', { class: 'devicelist' },
      (devices || []).map((d) =>
        h('div', { class: 'devicerow' + (d.is_current ? ' on' : ''), key: d.id },
          h('span', { class: 'devdot' }),
          h('div', { class: 'devinfo' },
            h('b', null, d.label || 'device'),
            h('span', { class: 'sub' }, d.is_current ? 'this device · ' : '' + rel(d.last_seen))
          ),
          !d.is_current && h('button', {
            class: 'btn ghost tiny',
            onClick: async () => {
              try { await backend.revokeDevice(d.id); await load(); }
              catch (e) { setMsg(e.message); }
            }
          }, 'Sign out')
        )
      ),
      devices && devices.length === 0 ? h('p', { class: 'sub' }, 'no other devices') : null
    ),
    changing
      ? h('form', { class: 'devform', onSubmit: async (e) => {
          e.preventDefault();
          setMsg('');
          try {
            await backend.setPassword(current, next);
            setMsg('Password updated ✓');
            setChanging(false);
            setCurrent(''); setNext('');
          } catch (err) { setMsg(err.message); }
        } },
          h('input', { class: 'field', type: 'password', placeholder: 'current password', value: current, onInput: (e) => setCurrent(e.currentTarget.value) }),
          h('input', { class: 'field', type: 'password', placeholder: 'new password (8+ chars)', value: next, onInput: (e) => setNext(e.currentTarget.value) }),
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost', type: 'button', onClick: () => setChanging(false) }, 'Cancel'),
            h('button', { class: 'btn primary', type: 'submit', disabled: next.length < 8 }, 'Save')
          )
        )
      : h('button', { class: 'btn ghost tiny', onClick: () => setChanging(true) }, 'Change password'),
    msg ? h('p', { class: 'beta' }, msg) : null
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

// Opens from any profile stat: followers, following, contacts, or the user's
// own casts. Each row carries the action it implies — follow back, unfollow,
// open a chat, delete a cast — so the lists are workbenches, not readouts.
function ProfileSheet({ kind, title, rows, following, onClose, onToggleFollow, onOpenChat, onDeleteCast, notify }) {
  const empties = {
    followers: 'Nobody follows you yet — share a glyph to gather eyes.',
    following: 'You are not following anyone yet.',
    contacts: 'No contacts yet — start a chat from the People tab.',
    casts: 'No casts yet. Cast or paint your first glyph.'
  };
  return h('div', { class: 'share-sheet', onClick: onClose },
    h('div', { class: 'sheet glass', onClick: (e) => e.stopPropagation() },
      h('h3', null, title),
      h('div', { class: 'sharemain' },
        (!rows || rows.length === 0)
          ? h('p', { class: 'empty' }, empties[kind] || 'Nothing here yet')
          : rows.map((r) =>
              kind === 'casts'
                ? h('div', { class: 'contact card', key: r.id },
                    h('div', { class: 'devinfo' },
                      h('b', null, r.label || 'A glyph'),
                      h('span', { class: 'sub' }, `${r.likes || 0} likes · ${new Date(r.created).toLocaleDateString()}`)
                    ),
                    h('button', { class: 'btn ghost tiny', onClick: async () => {
                      try { await onDeleteCast(r.id); } catch (e) { notify(e.message); }
                    } }, 'Delete')
                  )
                : h('div', { class: 'contact card', key: r.id, onClick: kind === 'contacts' ? () => onOpenChat(r) : undefined,
                    role: kind === 'contacts' ? 'button' : undefined },
                    h('span', { class: 'avatar mini' }, r.symbol || '✦'),
                    h('div', { class: 'devinfo' },
                      h('b', null, at(r.glyphname, r.name) || r.name || 'someone'),
                      r.name ? h('span', { class: 'sub' }, r.name) : null
                    ),
                    kind !== 'contacts' && h('button', {
                      class: 'btn ghost tiny', onClick: (e) => { e.stopPropagation(); onToggleFollow(r); }
                    }, following.has(r.id) ? 'Unfollow' : (kind === 'followers' ? 'Follow back' : 'Follow'))
                  )
            ),
        h('button', { class: 'btn ghost tiny', onClick: onClose }, 'Close')
      )
    )
  );
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
  const [backendOK, setBackendOK] = useState(() => getBackendConfig() !== 'offline');
  const [liveMsg, setLiveMsg] = useState(null);
  const [unread, setUnread] = useState(0);
  const [onlineIds, setOnlineIds] = useState({});
  const [following, setFollowing] = useState(new Set());
  const [followers, setFollowers] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [sheetData, setSheetData] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [activity, setActivity] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(null);
  const [comments, setComments] = useState({});
  const [conversations, setConversations] = useState([]);
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
      const [wall, users, follows, blocks, followerRows] = await Promise.all([
        backend.listWall(),
        backend.listUsers(),
        backend.listFollows('following'),
        backend.listBlocks(),
        backend.listFollows('followers')
      ]);
      setFollowing(new Set(follows.map((f) => f.id)));
      setFollowers(followerRows);
      setBlockedUsers(blocks);
      const blocked = new Set(blocks.map((b) => b.id));
      const who = {};
      users.forEach((u) => { who[u.id] = u; });
      setContacts(users.filter((u) => u.id !== getMyId() && !blocked.has(u.id)));
      setGlyphs(wall.map((r) => ({
        id: r.id, kind: r.kind, symbol: r.symbol, label: r.label,
        note: r.note || undefined, likes: r.likes || 0, svg: r.svg || undefined,
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
      // Verify the backend actually speaks the API before trusting it, so a
      // misconfigured URL drops us to a clean offline state instead of a
      // half-broken social experience.
      if (backendOK && backend && !(await backendReachable())) {
        setBackendOK(false);
      }

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
      const vapidPublic = 'BB8CxhxMF4ulvXx0CSm3YovhzGCc8fVqAY5fiK_Dr7gdSfNPh_MAGpqKKAEPVZ3WHrC7tG7YUmAY7pg4tYnKQJw';
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
      const meId = getMyId();
      if (!meId) return;
      try {
        // Heartbeat is presence only; never let it break the update cycle.
        backend.heartbeat().catch(() => {});
        const d = await backend.live(msgCursor.current);
        // Only advance the cursor after a successful read, so a failed poll
        // replays the same window instead of silently dropping messages.
        msgCursor.current = Date.now() - 1000;

        // Direct messages.
        // The unread badge is driven by the server's per-conversation read
        // markers, not by counting deltas here — a delta count and the thread
        // itself could disagree, which is what produced phantom unread badges.
        if (d.msgs && d.msgs.length) {
          for (const m of d.msgs) {
            const opened = convOpen(m.conv, openRef.current);
            if (!opened) {
              notify(`${at(m.sender_handle, m.sender_name)} · ${m.sender_name || 'someone'}: ${m.text.slice(0, 34)}`);
              pushActivity(`Message from ${at(m.sender_handle, m.sender_name)}`, m.created);
            }
          }
          setLiveMsg(d);
        }

        // Conversation list: recency order + per-person unread counts.
        if (d.conversations) {
          const readAt = {};
          for (const r of d.read || []) readAt[r.conv] = new Date(r.read_at).getTime();
          const peers = {};
          for (const u of contacts) peers[u.id] = u;
          const meIdNow = getMyId();
          const list = d.conversations.map((c) => {
            const otherId = c.conv.split('|').find((x) => x !== meIdNow) || '';
            // Label the row with the OTHER person, not whoever sent last — the
            // last sender is often me.
            const peer = peers[otherId] || {};
            const peerName = c.peer_handle || peer.glyphname || peer.name || (otherId ? 'someone' : '');
            const since = readAt[c.conv] || 0;
            const lastAt = new Date(c.last_at).getTime();
            return {
              conv: c.conv,
              contactId: otherId,
              name: at(peerName, ''),
              symbol: c.peer_symbol || peer.symbol || '✦',
              preview: c.last_text || '',
              lastAt,
              // Unread only when the newest message is from them and lands
              // after our last read of this thread.
              unread: lastAt > since && c.last_sender !== meIdNow ? 1 : 0
            };
          });
          setConversations(list);
        }

        // Wall (new casts / removed casts / likes / comment counts)
        // The key includes comment counts so a new comment updates the badge
        // without anyone opening the comments panel.
        const wallKey = d.wall
          .map((r) => `${r.id}:${r.likes}:${r.comments || 0}`)
          .join(',') + `#${d.wall.length}`;
        if (wallKey !== prevWallKey.current) {
          const likedIds = new Set((d.liked || []).map((l) => l.wall_id));
          for (const l of d.liked || []) {
            const who = at(l.liker_handle, l.liker_name);
            const whoName = l.liker_name && l.liker_name !== l.liker_handle ? ` (${l.liker_name})` : '';
            notify(`${l.liker_symbol || '♥'} ${who}${whoName} liked your glyph "${l.glyph_label}"`);
            pushActivity(`${at(l.liker_handle, l.liker_name)} liked "${l.glyph_label}"`, l.created);
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
            note: r.note || undefined, likes: r.likes || 0, svg: r.svg || undefined,
            commentCount: r.comments || 0,
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
              notify(`${at(c.commenter_handle, c.commenter_name)} commented on "${c.glyph_label}": ${c.comment_text.slice(0, 40)}`);
              pushActivity(`${at(c.commenter_handle, c.commenter_name)} commented on "${c.glyph_label}"`, c.created);
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

  // Coming back to the tab should catch up immediately rather than waiting for
  // the next poll, and the tab needs to stay current while it is in view.
  useEffect(() => {
    if (!profile || !backendOK || !backend) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        msgCursor.current = Date.now() - 15000;
        refresh().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [profile, backendOK]);

  const like = async (g) => {
    if (backendOK && backend) {
      // The server is the source of truth. Optimistic increments used to run
      // first, so a rejected like (e.g. already liked) left a phantom count.
      try {
        const r = await backend.likeWall(g.id);
        if (r && r.already) {
          notify('Already liked ✓');
          return;
        }
        event('like', { glyphId: g.id });
      } catch (e) {
        notify(e.message);
      }
      return;
    }
    setGlyphs((list) => list.map((x) => (x.id === g.id ? { ...x, likes: (x.likes || 0) + 1 } : x)));
    await store.like(g.id);
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
      // Reflect the new comment in the rail counter immediately.
      setGlyphs((list) => list.map((x) =>
        x.id === g.id ? { ...x, commentCount: (x.commentCount || 0) + 1 } : x
      ));
    }
  };

  const toggleFollow = async (u) => {
    if (!backend || !backendOK) { notify('Sign in to follow'); return; }
    if (following.has(u.id)) {
      await backend.unfollow(u.glyphname);
      setFollowing((s) => { const n = new Set(s); n.delete(u.id); return n; });
      notify(`Unfollowed ${at(u.glyphname)}`);
    } else {
      await backend.follow(u.glyphname);
      setFollowing((s) => { const n = new Set(s); n.add(u.id); return n; });
      notify(`Followed ${at(u.glyphname)}`);
      pushActivity(`You followed ${at(u.glyphname, u.name)}`);
      if (backend.event) backend.event('follow', { target: at(u.glyphname) }).catch(() => {});
    }
  };

  const blockUser = async (u) => {
    if (!backend || !backendOK) { notify('Sign in to block'); return; }
    await backend.block(u.glyphname);
    await refresh();
    setFollowing((s) => { const n = new Set(s); n.delete(u.id); return n; });
    notify(`Blocked ${at(u.glyphname)}`);
  };

  const unblockUser = async (u) => {
    if (!backend || !backendOK) return;
    await backend.unblock(u.glyphname);
    await refresh();
    notify(`Unblocked ${at(u.glyphname)}`);
  };

  const reportGlyph = async (g, reason) => {
    if (!backend || !backendOK) { notify('Sign in to report'); return; }
    await backend.report('glyph', g.id, reason);
    if (backend.event) backend.event('report', { kind: 'glyph' }).catch(() => {});
    notify('Reported — thank you');
  };

  const reportUser = async (u, reason) => {
    if (!backend || !backendOK) { notify('Sign in to report'); return; }
    await backend.report('user', u.id, reason);
    if (backend.event) backend.event('report', { kind: 'user' }).catch(() => {});
    notify('Reported — thank you');
  };

  const removeCast = async (id) => {
    if (backendOK && backend) {
      await backend.removeWall(id);
      setGlyphs((list) => list.filter((x) => x.id !== id));
      setSheetData((rows) => rows.filter((r) => r.id !== id));
      notify('Cast removed');
      refresh();
    }
  };

  // Profile stat sheets: every number on the profile is a door, not a label.
  const openSheet = async (kind) => {
    if (!backend || !backendOK) { notify('Connect to see the social graph'); return; }
    setSheet(kind);
    try {
      if (kind === 'followers') setSheetData(await backend.listFollows('followers'));
      else if (kind === 'following') setSheetData(await backend.listFollows('following'));
      else if (kind === 'contacts') setSheetData(contacts);
      else if (kind === 'casts') setSheetData(glyphs.filter((g) => g.who.rid === getMyId()));
    } catch (e) { notify(e.message); }
  };

  const sheetTitles = {
    followers: 'Followers',
    following: 'Following',
    contacts: 'Contacts',
    casts: 'Your casts'
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
      onSignUp: async ({ username, password, symbol }) => {
        let saved = { username, symbol };
        if (backendOK && backend) saved = await backend.signup({ username, password, symbol });
        const merged = {
          name: saved.name,
          glyphName: saved.glyphname || '@' + username,
          symbol: saved.symbol || symbol,
          joined: new Date().getTime()
        };
        await store.saveProfile(merged);
        setProfile(merged);
        notify('Welcome to Gliffon ✦');
        event('signup', { symbol: merged.symbol });
        refresh();
      },
      onSignIn: async (username, password) => {
        if (backendOK && backend) {
          const u = await backend.signIn(username, password);
          if (!u) throw new Error('wrong username or password');
          const p = {
            name: u.name,
            glyphName: u.glyphname,
            symbol: u.symbol,
            joined: new Date().getTime()
          };
          await store.saveProfile(p);
          setProfile(p);
          notify(`Signed in as ${u.glyphname} ✦`);
          refresh();
        } else {
          const p = { name: username, glyphName: '@' + username, symbol: '✦', joined: Date.now() };
          await store.saveProfile(p);
          setProfile(p);
          notify('Pinned locally ✓ (connect for the global Wall)');
        }
      },
      onSetPassword: async (current, password) => {
        if (backendOK && backend) await backend.setPassword(current, password);
        notify('Password set ✓ you can sign in on any device now');
      }
    });
  }

  // Blocked users' glyphs never reach the feed, in either filter mode.
  const visibleGlyphs = glyphs.filter((g) => !blockedUsers.some((b) => b.id === g.who.rid));
  const filteredGlyphs = feedFilter === 'following'
    ? visibleGlyphs.filter((g) => following.has(g.who.rid))
    : visibleGlyphs;

  // One source of truth for the chat badge: how many conversations have
  // something unread, regardless of which tab is open.
  const unreadTotal = conversations.filter((c) => c.unread).length;

  return h('div', { id: 'app' },
    h('header', { class: 'appbar' },
      h('span', { class: 'brand', onClick: () => setTab('reels') }, 'Gliffon'),
      backendOK && h('span', { class: 'live-indicator' }, 'live'),
      h('div', { class: 'tabs' },
        ['reels', 'glyphs', 'paint', 'chats', 'pulse', 'profile'].map((t) =>
          h('button', {
            key: t, class: 'tab' + (tab === t ? ' on' : ''),
            onClick: () => { setTab(t); setUnread(0); }
          }, t.charAt(0).toUpperCase() + t.slice(1),
            t === 'chats' && unreadTotal
              ? h('span', { class: 'tab-badge' }, unreadTotal > 9 ? '9+' : unreadTotal)
              : null
          )
        )
      ),
    h('div', { class: 'header-actions' },
      h('button', {
        class: 'iconbtn' + (feedFilter === 'following' ? ' on' : ''),
        title: feedFilter === 'all'
          ? 'All — every glyph in the community. Tap to show only people you follow.'
          : 'Following — only glyphs from people you follow. Tap to see everyone.',
        'aria-label': 'Feed filter: ' + feedFilter,
        onClick: () => setFeedFilter((f) => (f === 'all' ? 'following' : 'all'))
      }, feedFilter === 'following' ? 'Following' : 'All'),
      h('button', { class: 'iconbtn', title: 'Cast a glyph', onClick: () => setTab('glyphs') }, '✦'),
      h('button', { class: 'iconbtn', title: 'Sign out', onClick: signOut, 'aria-label': 'Sign out' },
        h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' },
          h('path', { d: 'M12 3v8' }),
          h('path', { d: 'M6.7 6.2a8 8 0 1 0 10.6 0' })
        )
      )
      )
    ),

    toast && h('div', { class: 'toast', onClick: () => setToast('') }, toast),

    tab === 'reels' && h(Reels, {
      glyphs: filteredGlyphs, like, onShare: (g) => setShareTarget(g),
      openComments, comments, addComment, commentsOpen,
      onlineIds, meId: getMyId(), profile, following, toggleFollow, blockUser,
      reportGlyph, reportUser, event, feedFilter, followingCount: following.size
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
      liveMsg, setLiveMsg, onlineIds, conversations,
      onRead: (conv) => setConversations((cs) => cs.map((c) => (c.conv === conv ? { ...c, unread: 0 } : c))),
      backendOK, backend, event
    }),

    tab === 'paint' && h(Paint, {
      profile, backendOK, backend, notify,
      onCast: async (g) => {
        if (backendOK && backend) {
          await backend.addToWall(g);
          event('paint_cast', {});
          notify('Painted glyph cast ✓');
        } else {
          await store.addGlyph(g);
          notify('Pinned locally ✓ (connect for the global Wall)');
        }
        setTab('reels');
        refresh();
      }
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
          h('button', { class: 'stat', title: 'See your casts', onClick: () => openSheet('casts') },
            h('b', null, glyphs.filter((g) => g.who.rid === getMyId()).length), h('small', { class: 'sub' }, 'casts')),
          h('button', { class: 'stat', title: 'See your followers', onClick: () => openSheet('followers') },
            h('b', null, followers.length), h('small', { class: 'sub' }, 'followers')),
          h('button', { class: 'stat', title: 'See who you follow', onClick: () => openSheet('following') },
            h('b', null, following.size), h('small', { class: 'sub' }, 'following')),
          h('button', { class: 'stat', title: 'See your contacts', onClick: () => openSheet('contacts') },
            h('b', null, contacts.length), h('small', { class: 'sub' }, 'contacts'))
        )
      ),
      h('div', { class: 'card manifestocard' },
        h('h3', { class: 'cardtitle' }, 'Gliffon is where symbols breathe'),
        h('p', { class: 'manifesto' },
          'Gliffon is not just an app — it is a living canvas of connection. In a world of fleeting posts and endless scrolls, we restore meaning: here, emotions are carved into symbols, shared as living glyphs.'),
        h('p', { class: 'manifesto' },
          'Every mood, every memory, every bond becomes a spark — intimate, timeless, unforgettable.'),
        h('div', { class: 'slogans' },
          h('span', null, '"Symbols of us, shared forever."'),
          h('span', null, '"More than words — it\'s a vibe."'),
          h('span', null, '"Say it in symbols."')
        )
      ),
      h('details', { class: 'settings' },
        h('summary', null, 'Settings'),
        backendOK && h(YourDevices),
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
                  h('span', null, at(u.glyphname)),
                  h('button', { class: 'btn ghost', onClick: () => unblockUser(u) }, 'Unblock')
                )
              )
        )
      )
    ),

    h('footer', { class: 'bottombar' },
      ['reels', 'glyphs', 'paint', 'chats', 'pulse', 'profile'].map((t) =>
        h('button', {
          key: t, class: 'bbtab' + (tab === t ? ' on' : ''),
          onClick: () => { setTab(t); setUnread(0); },
          'aria-label': t
        },
          t === 'reels' ? '❖' :
          t === 'glyphs' ? '◆' :
          t === 'paint' ? h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'aria-hidden': 'true' },
            h('path', { d: 'M17 3l4 4L8 20l-5 1 1-5L17 3z' })) :
          t === 'chats' ? '✉' + (unreadTotal ? ' ' + unreadTotal : '') :
          t === 'pulse' ? '⚡' :
          '◈')
      )
    ),

    sheet && h(ProfileSheet, {
      kind: sheet, title: sheetTitles[sheet] || '', rows: sheetData,
      following, onClose: () => setSheet(null),
      onToggleFollow: (u) => { toggleFollow(u); openSheet(sheet).catch(() => {}); },
      onOpenChat: (c) => { setSheet(null); setOpenChat(c.id); setTab('chats'); },
      onDeleteCast: removeCast,
      notify
    }),

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