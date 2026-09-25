import { h } from 'preact';

const KIND_LABEL = { love: 'Love', mood: 'Mood', memory: 'Memory', creativity: 'Creativity' };

export function Pulse({ glyphs }) {
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
    if (any) streak++;
    else if (i > 0) break;
  }

  const counts = { love: 0, mood: 0, memory: 0, creativity: 0 };
  glyphs.forEach((g) => { counts[g.kind]++; });
  const dominant = glyphs.length
    ? Object.entries(counts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return h('section', { class: 'pulse' },
    h('p', { class: 'eyebrow' }, 'Signal report'),
    h('div', { class: 'statrow' },
      h('div', { class: 'stat card' }, h('b', null, glyphs.length), h('span', { class: 'sub' }, 'glyphs cast')),
      h('div', { class: 'stat card' }, h('b', null, `${streak}d`), h('span', { class: 'sub' }, 'streak')),
      h('div', { class: 'stat card' }, h('b', null, dominant || '—'), h('span', { class: 'sub' }, 'dominant'))
    ),
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
    )
  );
}
