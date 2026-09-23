import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { KINDS, store } from './store.js';
import { shareGlyph } from './share.js';

export function Reels({ glyphs, profile, notify }) {
  const [likes, setLikes] = useState({});

  useEffect(() => {
    (async () => {
      const l = {};
      for (const g of glyphs) l[g.id] = g.likes || 0;
      setLikes(l);
    })();
  }, [glyphs]);

  if (glyphs.length === 0) {
    return h('div', { class: 'reels-empty' },
      h('div', { class: 'preview-glyph glow' }, '✦'),
      h('p', null, 'Your stream is empty'),
      h('p', { class: 'sub' }, 'Cast your first glyph to start the flow')
    );
  }

  return h('div', { class: 'reels' },
    glyphs.map((g) =>
      h('section', { class: `reel k-${g.kind}`, key: g.id },
        h('div', { class: 'reel-orb' }),
        h('div', { class: 'reel-glyph glow kface' }, g.symbol),
        h('div', { class: 'reel-meta glass' },
          h('div', null,
            h('span', { class: 'who' }, profile.glyphName),
            h('b', null, ` ${g.label}`),
            g.note ? h('p', { class: 'note' }, g.note) : null
          )
        ),
        h('div', { class: 'rail' },
          h('div', { class: 'rail-top' },
            h('button', {
              class: 'act',
              onClick: async () => {
                await store.like(g.id);
                setLikes({ ...likes, [g.id]: (likes[g.id] || 0) + 1 });
              }
            },
              h('span', null, '♥'),
              h('small', null, likes[g.id] || 0)
            ),
            h('button', { class: 'act', onClick: () => shareGlyph(g, notify) }, h('span', null, '⤴')),
          ),
          h('small', { class: 'kindlabel' }, KINDS.find((k) => k.kind === g.kind).name)
        )
      )
    )
  );
}
