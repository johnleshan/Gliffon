import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { store, KINDS, uid } from './store.js';
import { Composer } from './composer.jsx';
import { Onboarding } from './onboarding.jsx';
import { remind } from './share.js';
import { Pulse } from './pulse.jsx';
import { Reels } from './reels.jsx';
import { Chats } from './chats.jsx';
import { ShareSheet } from './share.jsx';

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

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const refresh = async () => {
    setGlyphs(await store.listGlyphs());
    setContacts(await store.listContacts());
  };

  useEffect(() => {
    (async () => {
      setProfile(await store.getProfile());
      await refresh();
      setReady(true);
      remind.schedule();
    })();
  }, []);

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

  const save = async (draft) => {
    await store.addGlyph({ id: uid(), created: Date.now(), likes: 0, ...draft });
    await refresh();
    setTab('reels');
  };

  const sendToContact = async (c) => {
    await store.addMessage({
      id: uid(),
      contactId: c.id,
      from: 'me',
      text: glyphCard(shareTarget),
      created: Date.now()
    });
    setShareTarget(null);
    setOpenChat(c.id);
    setTab('chats');
    notify(`Sent to ${c.name}`);
  };

  const castToWall = async () => {
    const g = glyphs.find((x) => x.id === shareTarget.id);
    if (g) {
      await store.deleteGlyph(g.id);
      await store.addGlyph({ ...g, wall: true });
      await refresh();
    }
    setShareTarget(null);
    setTab('reels');
    notify('Cast to the Wall ✓');
  };

  return h('div', { class: 'shell' },
    tab === 'glyphs' && h(Composer, { onGlyph: save }),
    tab === 'reels' && h(Reels, { glyphs, profile, onShare: setShareTarget, onRefresh: refresh }),
    tab === 'chats' && h(Chats, {
      openContactId: openChat,
      setOpenContactId: setOpenChat,
      refreshContacts: refresh
    }),
    tab === 'pulse' && h(Pulse, { glyphs }),
    tab === 'profile' && h('section', { class: 'profile' },
      h('div', { class: 'card profilecard' },
        h('span', { class: 'avatar glow' }, profile.glyphName.slice(0, 1).toUpperCase()),
        h('h2', null, profile.name),
        h('p', { class: 'sub' }, `glyph name: ${profile.glyphName}`),
        h('p', { class: 'sub' }, `since ${new Date(profile.joined).toLocaleDateString()} · ${glyphs.length} glyphs`)
      ),
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
      }, remindState === 'on' ? 'Reminders: on' : 'Reminders: off')
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
    h('div', { class: 'toast', role: 'status' }, toast)
  );
}
