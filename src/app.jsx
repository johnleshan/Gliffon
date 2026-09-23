import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { store, KINDS, uid } from './store.js';
import { Composer } from './composer.jsx';
import { Onboarding } from './onboarding.jsx';
import { shareGlyph, remind } from './share.js';

export function App() {
  const [profile, setProfile] = useState(undefined);
  const [glyphs, setGlyphs] = useState([]);
  const [tab, setTab] = useState('glyphs');
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const [remindState, setRemindState] = useState(() => remind.status());

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

  if (!ready) return null;

  if (!profile) {
    return h(Onboarding, {
      onDone: async (p) => {
        await store.saveProfile(p);
        setProfile(p);
      }
    });
  }

  const save = async (draft) => {
    await store.addGlyph({ id: uid(), created: Date.now(), ...draft });
    await refresh();
    setTab('timeline');
  };

  return h('div', { class: 'shell' },
    h('header', null,
      h('span', { class: 'logo' }, '◆'),
      h('div', null,
        h('h1', null, 'Glifon'),
        h('p', { class: 'sub' }, `Signed in as ${profile.name}`)
      )
    ),
    tab === 'glyphs'
      ? h('main', null, h(Composer, { onGlyph: save }))
      : tab === 'timeline'
        ? h('main', null,
            glyphs.length === 0
              ? h('p', { class: 'empty' }, 'No glyphs yet. Create your first one.')
              : glyphs.map((g) =>
                  h('div', { class: `glyph card k-${g.kind}`, key: g.id },
                    h('span', { class: 'sym' }, g.symbol),
                    h('div', null,
                      h('b', null, g.label),
                      g.moodTag ? h('span', { class: 'tag' }, ` ${g.moodTag}`) : null,
                      g.note ? h('p', { class: 'note' }, g.note) : null,
                      h('time', { datetime: new Date(g.created).toISOString() },
                        new Date(g.created).toLocaleString())
                    ),
                    h('div', { class: 'actions' },
                      h('button', {
                        class: 'share', 'aria-label': 'Share',
                        onClick: () => shareGlyph(g, notify)
                      }, '⤴'),
                      h('button', {
                        class: 'del', 'aria-label': 'Delete',
                        onClick: async () => { await store.deleteGlyph(g.id); await refresh(); }
                      }, '×')
                    )
                  )
                ))
        : h('main', null, h('div', { class: 'profile card' },
            h('span', { class: 'avatar' }, profile.glyphName.slice(0, 1).toUpperCase()),
            h('h2', null, profile.name),
            h('p', { class: 'sub' }, `Glyph ${profile.glyphName}`),
            h('p', { class: 'sub' }, `Member since ${new Date(profile.joined).toLocaleDateString()}`),
            h('p', { class: 'sub' }, `${glyphs.length} glyphs created`),
            h('button', {
              class: 'primary',
              onClick: async () => {
                if (remindState === 'on') {
                  remind.disable();
                  setRemindState('off');
                  notify('Reminders off');
                } else {
                  const r = await remind.enable();
                  setRemindState(r);
                  if (r === 'on') remind.schedule();
                  else if (r === 'denied') notify('Permission denied');
                  else notify('Notifications unsupported');
                }
              }
            },
              remindState === 'on'
                ? 'Turn off daily glyph reminder'
                : 'Turn on daily glyph reminder'
            )
          )),
    h('div', { class: 'toast', role: 'status' }, toast),
    h('nav', null,
      ['glyphs', 'timeline', 'profile'].map((t) =>
        h('button', {
          key: t,
          class: tab === t ? 'active' : '',
          onClick: () => setTab(t)
        }, t === 'glyphs' ? '✦ Create' : t === 'timeline' ? '☰ Timeline' : '☺ Profile')
      )
    )
  );
}
