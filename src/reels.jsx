import { h } from 'preact';
import { KINDS } from './store.js';

export function Reels({ glyphs, profile, onShare, onLike }) {
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
        h('div', { class: 'reel-glyph glow' }, g.symbol),
        h('div', { class: 'reel-meta glass' },
          h('div', null,
            h('span', { class: 'who' }, (g.who && g.who.glyphname) || (g.who && g.who.name) || profile.glyphName),
            h('b', null, ` ${g.label}`),
            g.note ? h('p', { class: 'note' }, g.note) : null
          )
        ),
        h('div', { class: 'rail' },
          h('button', {
            class: 'act',
            onClick: () => onLike(g)
          },
            h('span', null, '♥'),
            h('small', null, g.likes || 0)
          ),
          h('button', { class: 'act', onClick: () => onShare(g) }, h('span', null, '⤴')),
          h('small', { class: 'kindlabel' },
            (KINDS.find((k) => k.kind === g.kind) || {}).name || 'Glyph'
          )
        )
      )
    )
  );
}
