import { h } from 'preact';
import { useState } from 'preact/hooks';

export function Auth({ connected, onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [symbol, setSymbol] = useState('✦');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const symbols = ['✦', '❋', '◈', '☾', '✧', '⟡', '◆', '✵'];

  const isSignup = mode === 'signup';
  const bare = handle.trim().replace(/^@/, '');

  async function go() {
    setErr('');
    setBusy(true);
    try {
      if (isSignup) {
        const myKey = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : uid();
        await onSignUp({ name: name.trim() || bare, glyphName: handle, symbol }, myKey);
      } else {
        if (!key) throw new Error('account key required to sign in');
        await onSignIn(handle, key);
      }
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const valid = bare.length >= 2 && (isSignup || key.length >= 10);

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  return h('main', { class: 'onboard' },
    h('div', { class: 'onboardorb', 'aria-hidden': 'true' }),
    h('span', {
      class: 'avatar glow onboardbadge',
      style: 'width:96px;height:96px;font-size:38px'
    }, symbol),
    h('h1', { class: 'brand' }, 'Gliffon'),
    h('p', { class: 'sub' }, isSignup
      ? 'create your glyph identity — pick the badge of honour'
      : 'sign in with your glyph name and account key'),
    h('div', { class: 'authtabs' },
      h('button', { class: isSignup ? '' : 'on', onClick: () => { setMode('signin'); setErr(''); } }, 'Sign in'),
      h('button', { class: isSignup ? 'on' : '', onClick: () => { setMode('signup'); setErr(''); } }, 'Create account')
    ),
    isSignup
      ? h('input', {
          class: 'field', placeholder: 'Display name — what everyone sees', value: name,
          onInput: (e) => setName(e.currentTarget.value)
        })
      : null,
    h('input', {
      class: 'field', placeholder: isSignup ? 'Your @glyph name — your login' : '@glyphname', value: handle,
      onInput: (e) => setHandle(e.currentTarget.value)
    }),
    isSignup
      ? h('div', { class: 'symrow' },
          symbols.map((s) =>
            h('button', { key: s, class: 'sym' + (symbol === s ? ' picked' : ''), onClick: () => setSymbol(s) }, s)
          ))
      : null,
    !isSignup
      ? h('input', {
          class: 'field', type: 'password', placeholder: 'Account key (from signup)', value: key,
          onInput: (e) => setKey(e.currentTarget.value)
        })
      : null,
    isSignup && bare
      ? h('div', { class: 'idpreview' },
          h('span', { class: 'avatar glow' }, symbol),
          h('div', { class: 'idpreviewtxt' },
            h('strong', null, name.trim() || bare),
            h('span', { class: 'sub' }, '@' + bare + '  ' + symbol)
          )
        )
      : null,
    err ? h('p', { class: 'beta' }, err) : null,
    h('button', { class: 'btn primary', disabled: !valid || busy, onClick: go },
      isSignup ? 'Create ' + symbol : 'Sign in ' + symbol)
  );
}