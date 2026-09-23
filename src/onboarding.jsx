import { h } from 'preact';
import { useState } from 'preact/hooks';
import { KINDS } from './store.js';

export function Onboarding({ onDone }) {
  const [name, setName] = useState('');
  const [glyphName, setGlyphName] = useState('');
  const [symbol, setSymbol] = useState('✦');

  const symbols = ['✦', '❋', '◈', '☾', '✧', '⟡'];

  return h('main', { class: 'onboard' },
    h('span', { class: 'logo big' }, '◆'),
    h('h1', null, 'Welcome to Glifon'),
    h('p', { class: 'sub' }, 'Express what you feel through glyphs.'),
    h('input', {
      placeholder: 'Your name', value: name,
      onInput: (e) => setName(e.currentTarget.value)
    }),
    h('input', {
      placeholder: 'Name your personal glyph', value: glyphName,
      onInput: (e) => setGlyphName(e.currentTarget.value)
    }),
    h('div', { class: 'symrow' },
      symbols.map((s) =>
        h('button', {
          key: s, class: symbol === s ? 'symbtn picked' : 'symbtn',
          onClick: () => setSymbol(s)
        }, s)
      )
    ),
    h('button', {
      class: 'primary',
      disabled: !name.trim() || !glyphName.trim(),
      onClick: () => onDone({ name: name.trim(), glyphName: glyphName.trim(), joined: Date.now() })
    }, 'Enter Glifon')
  );
}
