import { h } from 'preact';

const KIND_LABEL = { love: 'Love', mood: 'Mood', memory: 'Memory', creativity: 'Creativity' };

export function Pulse({ glyphs }) {
  const dayStart = (d) => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  };

  const days = [...Array(7)].map((_, i) => {
    const start = dayStart(Date.now()) - (6 - i) * 86400000;
    return { label: 'SMTWTFS'[new Date(start).getDay()], count: glyphs.filter((g) => g.created >= start && g.created < start + 86400000).length };
  });
  const max = Math.max(1, ...days.map((d) => d.count));

  const streak = (() => {
    let n = 0;
    for (let i = 0; ; i++) {
      const start = dayStart(Date.now()) - i * 86400000;
      const any = glyphs.some((g) => g.created >= start && g.created < start + 86400000);
      if (any) n++;
      else if (i === 0) continue;
      else break;
    }
    return n;
  })();

  const counts = { love: 0, mood: 0, memory: 0, creativity: 0 };
  glyphs.forEach((g) => { counts[g.kind]++; });

  const dominant =
    glyphs.length === 0
      ? null
      : Object.entries(counts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])[0][0];

  return h('section', null,
    h('div', { class: 'statrow' },
      h('div', { class: 'stat card' },
        h('b', null, glyphs.length),
        h('span', { class: 'sub' }, 'glyphs cast')
      ),
      h('div', { class: 'stat card' },
        h('b', null, streak === 1 ? '1 day' : `${streak} days`),
        h('span', { class: 'sub' }, 'streak')
      ),
      h('div', { class: 'stat card' },
        h('b', null, dominant ? KIND_LABEL[dominant] : '—'),
        h('span', { class: 'sub' }, 'dominant')
      )
    ),
    h('div', { class: 'card pulse' },
      h('h3', null, 'Last 7 days'),
      h('div', { class: 'chart' },
        days.map((d, i) =>
          h('div', { class: 'barwrap', key: i },
            h('div', { class: 'bar', style: `height:${Math.round((d.count / max) * 100)}%` }),
            h('span', null, d.label)
          )
        )
      )
    ),
    h('div', { class: 'card pulse' },
      h('h3', null, 'Glyph kinds'),
      Object.entries(counts).map(([k, c]) =>
        h('div', { class: 'krow', key: k },
          h('span', { class: 'kname' }, KIND_LABEL[k]),
          h('div', { class: 'ktrack' },
            h('div', { class: `kfill k-${k}`, style: `width:${glyphs.length ? Math.round((c / glyphs.length) * 100) : 0}%` })
          ),
          h('b', { class: 'kcount' }, c)
        )
      )
    )
  );
}
