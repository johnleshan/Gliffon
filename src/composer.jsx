import { h } from 'preact';
import { useState } from 'preact/hooks';
import { KINDS } from './store.js';

export function Composer({ onGlyph }) {
  const [kind, setKind] = useState(KINDS[0].kind);
  const [symbol, setSymbol] = useState(KINDS[0].symbols[0]);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const current = KINDS.find((k) => k.kind === kind);

  const pickKind = (k) => {
    setKind(k.kind);
    setSymbol(k.symbols[0]);
  };

  return h('section', { class: `composer k-${kind}` },
    h('div', { class: 'composerhead' },
      h('p', { class: 'eyebrow' }, 'Ritual of casting'),
      h('h3', null, 'Cast a glyph')
    ),
    h('div', { class: 'kinds' },
      KINDS.map((k) =>
        h('button', {
          key: k.kind,
          class: `chip chip-${k.kind}` + (k.kind === kind ? ' on' : ''),
          'aria-pressed': k.kind === kind ? 'true' : 'false',
          onClick: () => pickKind(k)
        }, k.name)
      )
    ),
    h('div', { class: 'preview' },
      h('span', { class: 'preview-glow', 'aria-hidden': 'true' }),
      h('span', { class: 'preview-ring', 'aria-hidden': 'true' }),
      h('span', { class: 'preview-glyph glow kface', key: symbol }, symbol)
    ),
    h('div', { class: 'symgrid' },
      current.symbols.map((s) =>
        h('button', {
          key: s,
          class: 'sym' + (symbol === s ? ' picked' : ''),
          'aria-pressed': symbol === s ? 'true' : 'false',
          onClick: () => setSymbol(s)
        }, s)
      )
    ),
    h('div', { class: 'castform' },
      h('input', {
        class: 'field',
        placeholder: 'Name that feeling…', value: label, maxLength: 40,
        onInput: (e) => setLabel(e.currentTarget.value)
      }),
      h('textarea', {
        class: 'field', placeholder: 'Optional note…', value: note, rows: 3,
        onInput: (e) => setNote(e.currentTarget.value)
      }),
      h('button', {
        class: 'btn primary cast',
        disabled: !label.trim(),
        onClick: () => {
          onGlyph({
            kind, symbol,
            label: label.trim(),
            note: note.trim() || undefined
          });
          setLabel(''); setNote('');
        }
      }, 'Cast glyph ✦')
    )
  );
}
