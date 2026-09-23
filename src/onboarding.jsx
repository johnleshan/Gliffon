import { h } from 'preact';
import { useState } from 'preact/hooks';

export function Onboarding({ onDone }) {
  const [name, setName] = useState('');
  const [glyphName, setGlyphName] = useState('');
  const [symbol, setSymbol] = useState('✦');

  const symbols = ['✦', '❋', '◈', '☾', '✧', '⟡'];

  return h('main', { class: 'onboard' },
    h('span', { class: 'avatar glow', style: 'width:96px;height:96px;font-size:38px' }, '◆'),
    h('h1', null, 'Welcome to Gliffon'),
    h('p', { class: 'sub' }, 'Express what you feel. Keep what you mean.'),
    h('input', {
      class: 'field', placeholder: 'Your name', value: name, maxLength: 30,
      onInput: (e) => setName(e.currentTarget.value)
    }),
    h('input', {
      class: 'field', placeholder: 'Name your personal glyph', value: glyphName, maxLength: 30,
      onInput: (e) => setGlyphName(e.currentTarget.value)
    }),
    h('div', { class: 'symrow' },
      symbols.map((s) =>
        h('button', { key: s, class: 'sym' + (symbol === s ? ' picked' : ''), onClick: () => setSymbol(s) }, s)
      )
    ),
    h('button', {
      class: 'btn primary', style: 'max-width:320px',
      disabled: !name.trim() || !glyphName.trim(),
      onClick: () => onDone({
        name: name.trim(),
        glyphName: glyphName.trim(),
        joined: Date.now()
      })
    }, 'Enter Gliffon ✦')
  );
}
