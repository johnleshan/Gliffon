import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';

const KIND_LABEL = { love: 'Love', mood: 'Mood', memory: 'Memory', creativity: 'Creativity' };

export function Pulse({
  profile, glyphs, contacts, onlineIds, activity,
  following, blockedUsers, toggleFollow, blockUser, unblockUser,
  backendOK, backend, event, pushEnabled, setPushEnabled, subscribePush
}) {
  const [view, setView] = useState('activity'); // 'activity' | 'following' | 'blocked' | 'stats'
  const [search, setSearch] = useState('');

  const now = Date.now();

  const days = [...Array(7)].map((_, i) => {
    const start = new Date(now - (6 - i) * 86400000);
    start.setHours(0, 0, 0, 0);
    const s = start.getTime();
    return {
      label: 'SMTWTFS'[start.getDay()],
      count: glyphs.filter((g) => g.created >= s && g.created < s + 86400000).length
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const s = new Date(now - i * 86400000);
    s.setHours(0, 0, 0, 0);
    const any = glyphs.some((g) => g.created >= s.getTime() && g.created < s.getTime() + 86400000);
    if (any) streak++; else if (i > 0) break;
  }

  const counts = { love: 0, mood: 0, memory: 0, creativity: 0 };
  glyphs.forEach((g) => { counts[g.kind]++; });
  const dominant = glyphs.length
    ? Object.entries(counts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Activity view: recent likes, comments, follows
  const activityItems = activity.slice(0, 50).map((a, i) => h('div', { class: 'activity-item', key: i },
    h('span', { class: 'activity-time' }, new Date(a.created).toLocaleTimeString()),
    h('span', { class: 'activity-text' }, a.text)
  ));

  return h('section', { class: 'pulse' },
    h('p', { class: 'eyebrow' }, 'Signal report'),
    h('div', { class: 'statrow' },
      h('div', { class: 'stat card' }, h('b', null, glyphs.length), h('span', { class: 'sub' }, 'glyphs cast')),
      h('div', { class: 'stat card' }, h('b', null, `${streak}d`), h('span', { class: 'sub' }, 'streak')),
      h('div', { class: 'stat card' }, h('b', null, dominant || '—'), h('span', { class: 'sub' }, 'dominant'))
    ),

    h('div', { class: 'pulse-tabs' },
      ['stats', 'activity', 'following', 'blocked', 'push'].map((t) =>
        h('button', { class: 'ptab' + (view === t ? ' on' : ''), onClick: () => setView(t) }, t)
      )
    ),

    view === 'stats' && h(Fragment, {},
      h('div', { class: 'card' },
        h('h3', { class: 'cardtitle' }, 'Last 7 days'),
        h('div', { class: 'chart' },
          days.map((d, i) =>
            h('div', { class: 'barwrap', key: i },
              h('div', {
                class: 'bar',
                style: `height:${Math.max(4, Math.round((d.count / max) * 100))}%;--i:${i}`
              }),
              h('span', null, d.label)
            )
          )
        )
      ),
      h('div', { class: 'card' },
        h('h3', { class: 'cardtitle' }, 'Glyph kinds'),
        Object.entries(counts).map(([k, c], i) =>
          h('div', { class: 'krow', key: k },
            h('span', { class: 'kname' }, KIND_LABEL[k]),
            h('div', { class: 'ktrack' },
              h('div', {
                class: `kfill k-${k}`,
                style: `width:${glyphs.length ? Math.round((c / glyphs.length) * 100) : 0}%;--i:${i}`
              })
            ),
            h('b', { class: 'kcount' }, c)
          )
        )
      ),
      h('div', { class: 'card' },
        h('h3', { class: 'cardtitle' }, 'Community'),
        h('div', { class: 'statrow' },
          h('div', { class: 'stat' }, h('b', null, contacts.length + 1), h('span', { class: 'sub' }, 'people')),
          h('div', { class: 'stat' }, h('b', null, following.size), h('span', { class: 'sub' }, 'following')),
          h('div', { class: 'stat' }, h('b', null, Object.keys(onlineIds).length), h('span', { class: 'sub' }, 'online'))
        )
      )
    ),

    view === 'activity' && h('div', { class: 'card activity-feed' },
      h('h3', { class: 'cardtitle' }, 'Recent activity'),
      activityItems.length ? activityItems : h('p', { class: 'sub' }, 'No activity yet — cast a glyph or follow someone')
    ),

    view === 'following' && h('div', { class: 'card following-list' },
      h('div', { class: 'searchbar' },
        h('input', { class: 'field', placeholder: 'Find people…', value: search, onInput: (e) => setSearch(e.currentTarget.value) })
      ),
      contacts.filter((u) => u.glyphname.toLowerCase().includes(search.toLowerCase())).map((u) =>
        h('div', { class: 'follow-row', key: u.id },
          h('span', { class: 'avatar' + (onlineIds[u.id] ? ' online' : '') }, u.symbol),
          h('div', { class: 'follow-info' },
            h('b', null, '@' + u.glyphname),
            h('span', { class: 'sub' }, u.name)
          ),
          h('button', {
            class: 'btn ' + (following.has(u.id) ? 'ghost' : 'primary'),
            onClick: () => toggleFollow(u)
          }, following.has(u.id) ? 'Following' : 'Follow')
        )
      )
    ),

    view === 'blocked' && h('div', { class: 'card blocked-list' },
      blockedUsers.length === 0
        ? h('p', { class: 'sub' }, 'You have not blocked anyone')
        : blockedUsers.map((u) =>
            h('div', { class: 'blocked-item', key: u.id },
              h('span', { class: 'avatar' }, u.symbol),
              h('div', { class: 'follow-info' },
                h('b', null, '@' + u.glyphname),
                h('span', { class: 'sub' }, u.name)
              ),
              h('button', { class: 'btn ghost', onClick: () => unblockUser(u) }, 'Unblock')
            )
          )
    ),

    view === 'push' && h('div', { class: 'card push-settings' },
      h('h3', { class: 'cardtitle' }, 'Push notifications'),
      h('p', { class: 'sub' }, pushEnabled ? 'Enabled — you will get nudges even when the app is closed.' : 'Disabled — you only see live updates while the app is open.'),
      h('button', {
        class: 'btn ' + (pushEnabled ? 'ghost' : 'primary'),
        onClick: async () => {
          if (pushEnabled) {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) { await sub.unsubscribe(); await backend.pushUnsubscribe(sub.endpoint); setPushEnabled(false); }
          } else {
            await subscribePush(await navigator.serviceWorker.ready);
          }
        }
      }, pushEnabled ? 'Disable' : 'Enable')
    )
  );
}