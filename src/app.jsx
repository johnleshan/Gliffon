import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { store, KINDS, uid } from './store.js';
import { Composer } from './composer.jsx';
import { Onboarding } from './onboarding.jsx';
import { remind, glyphCard } from './share.js';
import { Pulse } from './pulse.jsx';
import { Reels } from './reels.jsx';
import { Chats } from './chats.jsx';
import { ShareSheet } from './share.jsx';
import { ConnectSheet } from './connect.jsx';
import { backend, getBackendConfig, myId } from './backend.js';

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
  const [backendOK, setBackendOK] = useState(() => !!getBackendConfig());
  const [liveMsg, setLiveMsg] = useState(null);
  const [connect, setConnect] = useState(false);
  const openRef = useRef(null);
  openRef.current = openChat;

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

  // when profile exists + backend configured: register me, load data, poll for live updates
  useEffect(() => {
    if (!profile || !backendOK || !backend) return;
    let alive = true;
    (async () => {
      try {
        await backend.ensureUser(profile);
        await refresh();
      } catch (e) {
        notify('Backend: ' + e.message);
      }
    })();
    const tick = setInterval(async () => {
      if (document.visibilityState === 'hidden' || !alive) return;
      try {
        await refresh();
        setLiveMsg({ _t: Date.now() });
      } catch {}
    }, 4000);
    return () => { alive = false; clearInterval(tick); };
  }, [profile, backendOK]);

  if (!ready) {
    return h('div', { class: 'boot' }, h('span', { class: 'preview-glyph glow' }, '◆'));
  }

  if (!profile) {
    return h(Onboarding, {
      onDone: async (p) => {
        await store.saveProfile(p);
        setProfile(p);
      }
    });
  }

  const cast = async (draft) => {
    const g = { id: uid(), created: Date.now(), likes: 0, ...draft };
    if (backendOK && backend) {
      await backend.addToWall(g);
      await refresh();
    } else {
      await store.addGlyph(g);
      await refresh();
    }
    setTab('reels');
  };

  const like = async (g) => {
    if (backendOK && backend) {
      await backend.likeWall(g.id);
    } else {
      await store.like(g.id);
    }
    await refresh();
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
    tab === 'glyphs' && h(Composer, { onGlyph: cast }),
    tab === 'reels' && h(Reels, {
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
      notify
    }),
    tab === 'pulse' && h(Pulse, { glyphs }),
    tab === 'profile' && h('section', { class: 'profile' },
      h('div', { class: 'card profilecard' },
        h('span', { class: 'avatar glow' }, profile.glyphName.slice(0, 1).toUpperCase()),
        h('h2', null, profile.name),
        h('p', { class: 'sub' }, `glyph name: ${profile.glyphName}`),
        h('p', { class: 'sub' }, `since ${new Date(profile.joined).toLocaleDateString()} · ${glyphs.length} glyphs`)
      ),
      !backendOK
        ? h('button', { class: 'btn primary', onClick: () => setConnect(true) }, '🌐 Connect people (free)')
        : h('button', { class: 'btn primary', onClick: () => setConnect(true) }, '🌐 Supabase: connected ✓'),
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
          await store.saveProfile({ ...profile, symbol: profile.symbol || '✦' });
          notify('Profile saved');
        }
      }, 'Save profile')
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
          onClick: () => setTab(t)
        },
          h('span', { class: 'navicon' }, icon),
          name
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
