import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { KINDS } from './store.js';
import { at } from './backend.js';

export function Reels({
  glyphs, like, onShare, openComments, comments, addComment, commentsOpen,
  onlineIds, meId, profile, following, toggleFollow, blockUser,
  reportGlyph, reportUser, event
}) {
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState({});
  const [commentText, setCommentText] = useState({});
  const [menuFor, setMenuFor] = useState(null);
  const box = useRef(null);
  const ticking = useRef(false);

  const likeFx = (g) => {
    setLiked((m) => ({ ...m, [g.id]: true }));
    like(g);
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

  const cs = commentsOpen ? (comments[commentsOpen] || []) : [];

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
      h('span', { class: 'reelcount-progress' },
        h('i', { class: 'reelcount-fill', style: `transform:scaleX(${String((active + 1) / Math.max(1, glyphs.length)).slice(0, 5)})` })
      ),
      h('span', { class: 'reelcount-total' }, String(glyphs.length).padStart(2, '0'))
    ),
    glyphs.map((g, i) => {
      const isMe = !!(g.who && g.who.rid && g.who.rid === meId);
      const isFollowing = !!(g.who && following.has(g.who.rid));

      return h('section', { class: `reel k-${g.kind}` + (i === active ? ' is-active' : ''), key: g.id },
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
              h('span', { class: 'who' },
                at(g.who && g.who.glyphname, g.who && g.who.name) || 'unknown',
                g.who && onlineIds[g.who.rid] && h('span', { class: 'dot online' })
              ),
              h('b', null, ` ${g.label}`)
            ),
            g.note ? h('p', { class: 'note' }, g.note) : null
          ),
          commentsOpen === g.id && h('div', { class: 'comment-panel' },
            cs.map((c) => h('div', { class: 'comment', key: c.id },
              h('span', { class: 'avatar' }, c.author_symbol || '✦'),
              h('div', { class: 'comment-body' },
                h('div', { class: 'comment-header' },
                  h('span', { class: 'who' }, at(c.author_handle, c.author_name) || 'unknown'),
                  h('span', { class: 'time sub' }, new Date(c.created).toLocaleTimeString())
                ),
                h('p', null, c.text)
              )
            )),
            h('form', { class: 'comment-form', onSubmit: (e) => { e.preventDefault(); addComment(g, commentText[g.id] || ''); setCommentText((p) => ({ ...p, [g.id]: '' })); } },
              h('input', {
                class: 'field', placeholder: 'Add a comment…', value: commentText[g.id] || '',
                onInput: (e) => setCommentText((p) => ({ ...p, [g.id]: e.currentTarget.value }))
              }),
              h('button', { class: 'btn primary', type: 'submit' }, 'Post')
            )
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
          h('button', {
            class: 'act' + (commentsOpen === g.id ? ' on' : ''),
            'aria-label': 'open comments',
            onClick: () => openComments(g)
          },
            h('span', null, '💬'),
            h('small', { class: 'count' }, (comments[g.id] || []).length)
          ),
          g.who && !isMe && h('button', {
            class: 'act' + (isFollowing ? ' following' : ''),
            'aria-label': isFollowing ? 'unfollow' : 'follow',
            onClick: () => toggleFollow(g.who)
          }, isFollowing ? '✓' : '+'),
          h('button', { class: 'act share', 'aria-label': 'share glyph', onClick: () => onShare(g) },
            h('span', null, '↗')
          ),
          h('button', {
            class: 'act more', 'aria-label': 'more options',
            onClick: () => setMenuFor(menuFor === g.id ? null : g.id)
          }, h('span', null, '⋯')),
          h('small', { class: 'kindlabel' },
            (KINDS.find((k) => k.kind === g.kind) || {}).name || 'Glyph'
          ),
          menuFor === g.id && h('div', { class: 'reelmenu glass' },
            h('button', { class: 'mi', onClick: () => { navigator.clipboard?.writeText(location.origin + '/g/' + g.id); setMenuFor(null); event('copy_link', { glyphId: g.id }); } },
              'Copy link'),
            h('button', { class: 'mi', onClick: () => { reportGlyph(g, 'misleading or spam'); setMenuFor(null); } },
              'Report glyph'),
            g.who && !isMe && h('button', {
              class: 'mi danger', onClick: () => { blockUser({ id: g.who.rid, glyphname: (g.who.glyphname || '').replace('@', '') }); setMenuFor(null); }
            }, 'Block ' + (g.who.glyphname || g.who.name)),
            g.who && !isMe && h('button', { class: 'mi', onClick: () => { reportUser({ id: g.who.rid }, 'harassment or spam'); setMenuFor(null); } },
              'Report ' + (g.who.glyphname || g.who.name))
          )
        )
      );
    })
  );
}