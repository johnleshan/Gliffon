import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { KINDS } from './store.js';

// Cinematic reel staging: presentational scroll tracking (active index),
// optimistic "liked" visual pop, and a typographic advancement counter.
// All data flow (glyphs, onLike, onShare) is untouched.
export function Reels({ glyphs, profile, onShare, onLike }) {
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState({});
  const box = useRef(null);
  const ticking = useRef(false);

  const likeFx = (g) => {
    setLiked((m) => ({ ...m, [g.id]: true }));
    onLike(g);
  };

  const onScroll = () => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const el = box.current;
      if (!el) return;
      const i = Math.max(0, Math.min(glyphs.length - 1, Math.round(el.scrollTop / Math.max(1, el.clientHeight))));
      setActive((prev) => (prev === i ? prev : i));
    });
  };

  if (glyphs.length === 0) {
    return h('div', { class: 'reels-empty' },
      h('div', { class: 'preview-glyph glow' }, '✦'),
      h('p', null, 'Your stream is empty'),
      h('p', { class: 'sub' }, 'Cast your first glyph to start the flow')
    );
  }

  return h('div', { class: 'reels', ref: box, onScroll },
    h('div', { class: 'reelcount', 'aria-hidden': 'true' },
      h('span', { class: 'reelcount-now' }, String(active + 1).padStart(2, '0')),
      h('span', { class: 'reelcount-line' }),
      h('span', { class: 'reelcount-total' }, String(glyphs.length).padStart(2, '0'))
    ),
    glyphs.map((g, i) =>
      h('section', { class: `reel k-${g.kind}` + (i === active ? ' is-active' : ''), key: g.id },
        h('div', { class: 'reel-back', 'aria-hidden': 'true' }),
        h('div', { class: 'reel-orb', 'aria-hidden': 'true' }),
        h('div', { class: 'reel-orb orb2', 'aria-hidden': 'true' }),
        h('div', { class: 'reel-center' },
          h('div', { class: 'reel-stage' },
            h('span', { class: 'reel-glyph glow' }, g.symbol)
          )
        ),
        h('div', { class: 'reel-meta glass' },
          h('div', null,
            h('span', { class: 'kicker' },
              (KINDS.find((k) => k.kind === g.kind) || {}).name || 'Glyph'),
            h('div', { class: 'metaline' },
              h('span', { class: 'who' }, (g.who && g.who.glyphname) || (g.who && g.who.name) || profile.glyphName),
              h('b', null, ` ${g.label}`)
            ),
            g.note ? h('p', { class: 'note' }, g.note) : null
          )
        ),
        h('div', { class: 'rail' },
          h('button', {
            class: 'act' + (liked[g.id] ? ' liked' : ''),
            'aria-label': 'like glyph',
            onClick: () => likeFx(g)
          },
            h('span', { class: 'heart' }, '♥'),
            h('small', { class: 'count', key: g.likes || 0 }, g.likes || 0)
          ),
          h('button', { class: 'act share', 'aria-label': 'share glyph', onClick: () => onShare(g) },
            h('span', null, '⤴')
          ),
          h('small', { class: 'kindlabel' },
            (KINDS.find((k) => k.kind === g.kind) || {}).name || 'Glyph'
          )
        )
      )
    )
  );
}
