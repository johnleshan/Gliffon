import { h } from 'preact';
import { useState } from 'preact/hooks';
import { glyphCard } from './share.js';

// In-app share sheet: send to a contact, cast to the wall, or native share fallback.
export function ShareSheet({ glyph, contacts = [], onSendToContact, onCastToWall, onClose }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = location.origin + '/g/' + glyph.id;

  return h('div', { class: 'share-sheet', onClick: () => onClose() },
    h('div', { class: 'sheet glass', onClick: (e) => e.stopPropagation() },
      h('h3', null, 'Share glyph'),
      h('div', { class: 'hint' }, glyph.symbol + '  ' + glyph.label),
      h('div', { class: 'sharemain' },
        h('h4', null, 'Send to…'),
        contacts.length === 0
          ? h('p', { class: 'empty' }, 'No contacts yet — add one in Chats.')
          : contacts.map((c) =>
              h('button', { class: 'contact card', key: c.id, onClick: () => onSendToContact(c) },
                h('span', { class: 'avatar mini' }, c.symbol),
                h('b', null, c.name),
                h('span', { class: 'chev' }, '›')
              )
            ),
        h('button', { class: 'btn primary', onClick: () => onCastToWall() }, '🗼 Cast to the Wall'),
        h('button', {
          class: 'btn', onClick: async () => {
            try {
              await navigator.clipboard.writeText(shareUrl + '\n' + glyphCard(glyph));
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {}
          }
        }, copied ? 'Copied ✓' : 'Copy link'),
        h('button', {
          class: 'btn ghost', onClick: async () => {
            if (navigator.share) {
              try { await navigator.share({ title: 'Glifon glyph', text: glyphCard(glyph), url: shareUrl }); } catch {}
            }
            onClose();
          }
        }, '↗ More (native share)')
      )
    )
  );
}