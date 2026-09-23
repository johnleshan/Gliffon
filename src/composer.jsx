import { h } from 'preact';
import { useState } from 'preact/hooks';
import { KINDS } from './store.js';

export function Composer({ onGlyph }) {
  const [kind, setKind] = useState(KINDS[0].kind);
  const [symbol, setSymbol] = useState(KINDS[0].symbols[0]);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const pickKind = (k) => {
    setKind(k.kind);
    setSymbol(k.symbols[0]);
  };

  return h('section', null,
    h('div', { class: 'kindrow' },
      KINDS.map((k) =>
        h('button', {
          key: k.kind, class: k.kind === kind ? 'kindbtn active' : 'kindbtn',
          onClick: () => pickKind(k)
        }, k.name)
      )
    ),
    h('div', { class: 'symgrid' },
      (KINDS.find((k) => k.kind === kind)).symbols.map((s) =>
        h('button', {
          key: s, class: symbol === s ? 'symgridbtn picked' : 'symgridbtn',
          onClick: () => setSymbol(s)
        }, s)
      )
    ),
    h('input', {
      placeholder: 'What is it?', value: label,
      onInput: (e) => setLabel(e.currentTarget.value)
    }),
    h('textarea', {
      placeholder: 'Optional note…', value: note, rows: 3,
      onInput: (e) => setNote(e.currentTarget.value)
    }),
    h('button', {
      class: 'primary',
      disabled: !label.trim(),
      onClick: () => {
        onGlyph({
          kind, symbol,
          label: label.trim(),
          note: note.trim() || undefined
        });
        setLabel(''); setNote('');
      }
    }, 'Cast glyph')
  );
}
