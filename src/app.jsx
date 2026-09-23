import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { store, KINDS, uid } from './store.js';
import { Composer } from './composer.jsx';
import { Onboarding } from './onboarding.jsx';
import { shareGlyph, remind } from './share.js';
import { Pulse } from './pulse.jsx';
import { Reels } from './reels.jsx';
import { Chats } from './chats.jsx';

export function App() {
  const [profile, setProfile] = useState(undefined);

  const [glyphs, setGlyphs] = useState([]);
  const [tab, setTab] = useState('reels');
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const [remindState, setRemindState] = useState(() => remind.status());
  const [openChat, setOpenChat] = useState(null);
  const [chatCount, setChatCount] = useState(0);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const refresh = async () => setGlyphs(await store.listGlyphs());

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

  return h('div', { class: 'shell' },
    tab === 'glyphs' && h(Composer, { onGlyph: save }),
    tab === 'reels' && h(Reels, { glyphs, profile, notify }),
    tab === 'chats' && h(Chats, { openContactId: openChat, setOpenContactId: setOpenChat, onCount: setChatCount }),
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
          name,
          t === 'chats' && chatCount > 0
            ? h('span', { class: 'badge' }, chatCount)
            : null
        )
      )
    ),
    h('div', { class: 'toast', role: 'status' }, toast)
  );
}
