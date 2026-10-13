import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { backend } from './backend.js';

// Lookalike defence: 'j0hn' must not pass as 'john', 'john.smith' as 'johnsmith'.
const DIGIT_CAST = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
const cast = (n) => n.replace(/[01345789]/g, (c) => DIGIT_CAST[c] || c);
const norm = (u) =>
  String(u || '').toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9._-]/g, '').replace(/[._-]+/g, '');

const SAFE_SYMBOLS = ['✦', '◆', '◈', '✧', '☾', '✩', '❖', '★'];
const SEEDS = ['luna', 'nova', 'echo', 'iris', 'fable', 'ember', 'glow', 'vibe', 'arcus', 'serin'];
const genSeed = () => SEEDS[Math.floor(Math.random() * SEEDS.length)] + Math.floor(10 + Math.random() * 90);

const strength = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^\w\s]/.test(pw)) s++;
  return Math.min(4, s);
};
const STRENGTH_WORDS = ['too short', 'weak', 'okay', 'good', 'strong'];

export function Auth({ connected, onSignIn, onSignUp, onSetPassword }) {
  const [mode, setMode] = useState('signup'); // 'signup' | 'signin' | 'password'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [symbol, setSymbol] = useState('✦');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [directory, setDirectory] = useState([]);

  useEffect(() => {
    setUsername(genSeed());
    if (!connected || !backend) return;
    let alive = true;
    (async () => {
      try {
        const users = await backend.listUsers();
        if (alive) setDirectory(users || []);
      } catch { /* availability check is best-effort */ }
    })();
    return () => { alive = false; };
  }, [connected]);

  const bare = username.trim().replace(/^@+/, '').toLowerCase();
  const key = norm(bare);
  const look = cast(key);

  const clash = (() => {
    if (!key || mode !== 'signup') return null;
    for (const u of directory) {
      const theirs = norm(u.glyphname || '');
      if (theirs && (theirs === key || cast(theirs) === look)) return u.glyphname;
    }
    return null;
  })();

  const userOk = /^[a-z0-9._-]{3,20}$/.test(bare) && /[a-z]/.test(bare);
  const pwOk = password.length >= 8;
  const pwScore = strength(password);
  const valid = mode === 'signin' ? (userOk && password) : (userOk && pwOk && !clash);

  const suggest = () => {
    let base = bare.replace(/[0-9]+$/, '') || 'glow';
    for (let i = 2; i < 999; i++) {
      const cand = base + i;
      const k1 = norm(cand), k2 = cast(k1);
      if (!directory.some((u) => {
        const t = norm(u.glyphname || '');
        return t === k1 || cast(t) === k2;
      })) return cand;
    }
    return base + Math.floor(Math.random() * 9000);
  };

  const submit = async (ev) => {
    if (ev) ev.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        await onSignUp({ username: bare, password, symbol });
      } else if (mode === 'signin') {
        await onSignIn(bare, password);
      } else {
        await onSetPassword('', password);
        setMode('signin');
        setPassword('');
      }
    } catch (e) {
      setErr(String(e.message || e));
    }
    setBusy(false);
  };

  const cta = mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Set password';

  return h('main', { class: 'onboard' },
    h('div', { class: 'onboardorb', 'aria-hidden': 'true' }),
    h('span', {
      class: 'avatar glow onboardbadge',
      style: 'width:96px;height:96px;font-size:38px'
    }, symbol),
    h('h1', { class: 'brand' }, 'Glifon'),

    h('div', { class: 'authtabs' },
      [
        ['signin', 'Sign in'],
        ['signup', 'Create account'],
        ['password', 'Set password']
      ].map(([k, label]) =>
        h('button', {
          key: k,
          class: mode === k ? 'on' : '',
          onClick: () => { setMode(k); setErr(''); }
        }, label)
      )
    ),

    h('p', { class: 'sub' },
      mode === 'signup' ? 'one username, one password — sign in anywhere'
      : mode === 'signin' ? 'welcome back'
      : 'add a password so you can sign in on any device'),

    mode === 'signup'
      ? h('div', { class: 'symrow', role: 'radiogroup', 'aria-label': 'Choose your symbol' },
          SAFE_SYMBOLS.map((s) =>
            h('button', { key: s, class: 'sym' + (symbol === s ? ' picked' : ''), onClick: () => setSymbol(s) }, s)
          ))
      : null,

    h('form', { class: 'authform', onSubmit: submit },
      mode !== 'password'
        ? h('div', { class: 'claimwrap' + (clash ? ' bad' : mode === 'signup' && valid ? ' good' : '') },
            h('span', { class: 'atalias' }, '@'),
            h('input', {
              class: 'field',
              placeholder: mode === 'signin' ? 'your username' : 'choose a username',
              value: bare,
              maxLength: 20,
              autoComplete: 'username',
              spellcheck: false,
              onInput: (e) => setUsername(e.currentTarget.value.replace(/\s+/g, ''))
            })
          )
        : null,

      mode === 'signup' && bare
        ? h('p', { class: 'hint fade' + (clash ? '' : valid ? ' ok' : '') },
            clash
              ? (String(clash).toLowerCase() === '@' + bare
                  ? `“${bare}” is taken — one identity per soul`
                  : `“${bare}” is too similar to ${String(clash)} — one identity per soul`)
              : valid
                ? '@' + bare + ' is available'
                : '3–20 characters: letters, numbers, dots, dashes')
        : null,

      h('div', { class: 'claimwrap pwrow' + (password && pwOk ? ' good' : '') },
        h('input', {
          class: 'field',
          type: showPw ? 'text' : 'password',
          placeholder: mode === 'password' ? 'new password' : 'password',
          value: password,
          autoComplete: mode === 'signin' ? 'current-password' : 'new-password',
          onInput: (e) => setPassword(e.currentTarget.value)
        }),
        h('button', {
          type: 'button', class: 'pweye', 'aria-label': showPw ? 'hide password' : 'show password',
          onClick: () => setShowPw((v) => !v)
        }, showPw ? 'Hide' : 'Show')
      ),

      mode === 'signup' && password
        ? h('div', { class: 'pwstrength' },
            h('div', { class: 'pwbar' },
              h('span', { class: 'pwfill lvl' + pwScore, style: `width:${(pwScore / 4) * 100}%` })
            ),
            h('span', { class: 'sub' },
              pwOk ? STRENGTH_WORDS[pwScore] : 'at least 8 characters')
          )
        : null,

      err ? h('p', { class: 'beta' }, err) : null,

      h('button', { class: 'btn primary', disabled: !valid || busy, type: 'submit' },
        busy ? 'one moment…' : cta)
    ),

    h('p', { class: 'foot' },
      connected
        ? 'Live on Glifon — your account works on every device you sign in from'
        : 'Working offline — connect to sign in to the global Wall')
  );
}
