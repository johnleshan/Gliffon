import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { backend, getToken } from './backend.js';

// Lookalike defence: 'j0hn' vs 'john', 'john.smith' vs 'johnsmith', '❥' etc.
const DIGIT_CAST = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
const cast = (n) => n.replace(/[01345789]/g, (c) => DIGIT_CAST[c] || c);
const norm = (handle) =>
  String(handle || '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[._-]+/g, '');

const SAFE_SYMBOLS = ['✦', '◆', '◈', '✧', '☾', '✩', '❖', '★'];
const SEEDS = ['luna', 'nova', 'echo', 'iris', 'fable', 'ember', 'glow', 'vibe', 'arcus', 'serin'];
const genSeed = () => SEEDS[Math.floor(Math.random() * SEEDS.length)] + Math.floor(10 + Math.random() * 90);

export function Auth({ connected, onSignIn, onSignUp }) {
  const [mode, setMode] = useState('new'); // 'new' | 'restore'
  const [handle, setHandle] = useState('');
  const [symbol, setSymbol] = useState('✦');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // live uniqueness check against the glyph directory
  const [taken, setTaken] = useState(null); // null | { name, suggest }
  const [directory, setDirectory] = useState([]);

  useEffect(() => {
    let alive = true;
    setHandle(genSeed());
    (async () => {
      if (!connected || !backend) return;
      try {
        const users = await backend.listUsers();
        if (alive) setDirectory(users || []);
      } catch { /* directory check is best-effort */ }
    })();
    return () => { alive = false; };
  }, [connected]);

  const bare = handle.trim().replace(/^@+/, '').toLowerCase();
  const nameKey = norm(bare);
  const lookKey = cast(nameKey);

  const conflicts = () => {
    if (!nameKey) return null;
    for (const u of directory || []) {
      const theirs = norm(u.glyphname || '');
      if (!theirs) continue;
      if (theirs === nameKey || cast(theirs) === lookKey) return u.glyphname;
    }
    return null;
  };

  const clash = conflicts();
  const valid = mode === 'restore'
    ? bare.length >= 2 && key.length >= 10
    : /^[a-z0-9._-]{3,20}$/.test(bare) && /[a-z]/.test(bare) && !clash;

  const suggest = () => {
    // bump a number onto the seed until both checks pass
    let n = bare.replace(/[0-9]+$/, '') || 'glow';
    for (let i = 2; i < 999; i++) {
      const cand = n + i;
      if (candidatesFree(cand)) return cand;
    }
    return n + Math.floor(Math.random() * 9000);
  };
  const candidatesFree = (c) => {
    const k1 = norm(c), k2 = cast(k1);
    return !(directory || []).some((u) => {
      const t = norm(u.glyphname || '');
      return t === k1 || cast(t) === k2;
    });
  };

  const tryIt = async () => {
    setErr('');
    setBusy(true);
    try {
      if (mode === 'restore') {
        await onSignIn(bare, key);
        return;
      }
      const myKey = (self.crypto && self.crypto.randomUUID)
        ? self.crypto.randomUUID().replace(/-/g, '')
        : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      await onSignUp({ name: '', glyphName: bare, symbol }, myKey);
    } catch (e) {
      const msg = String(e.message || e);
      if (/taken/i.test(msg)) {
        setTaken({ name: bare, suggest: suggest() });
        setErr('that glyph name is taken');
      } else {
        setErr(msg);
      }
    }
    setBusy(false);
  };

  return h('main', { class: 'onboard' },
    h('div', { class: 'onboardorb', 'aria-hidden': 'true' }),
    h('span', {
      class: 'avatar glow onboardbadge',
      style: 'width:96px;height:96px;font-size:38px'
    }, symbol),
    h('h1', { class: 'brand' }, 'Gliffon'),
    h('p', { class: 'sub' },
      mode === 'new'
        ? 'pick a badge, cast a name — you are in'
        : 'restoring on a new device? your key unlocks your glyph'),

    mode === 'new'
      ? h('div', { class: 'symrow', role: 'radiogroup', 'aria-label': 'Choose your symbol' },
          SAFE_SYMBOLS.map((s) =>
            h('button', { key: s, class: 'sym' + (symbol === s ? ' picked' : ''), onClick: () => setSymbol(s) }, s)
          ))
      : null,

    mode === 'new'
      ? h('div', { class: 'claimwrap' + (clash ? ' bad' : valid ? ' good' : '') },
          h('span', { class: 'atalias' }, '@'),
          h('input', {
            class: 'field',
            placeholder: 'your glyph name',
            value: bare,
            maxLength: 20,
            autoComplete: 'off',
            spellcheck: false,
            onInput: (e) => {
              setHandle(e.currentTarget.value.replace(/\s+/g, ''));
              setTaken(null);
            }
          })
        )
      : h('input', {
          class: 'field', placeholder: '@glyphname', value: bare,
          onInput: (e) => setHandle(e.currentTarget.value)
        }),

    mode === 'new' && bare
      ? h('p', { class: 'hint fade' + (clash ? '' : valid ? ' ok' : '') },
          clash
            ? (String(clash).toLowerCase() === '@' + bare
                ? `“${bare}” is taken — one identity per soul`
                : `“${bare}” is too similar to ${String(clash)} — one identity per soul`)
            : valid
              ? (taken
                  ? h('span', null,
                      'taken — try ',
                      h('button', { class: 'linkish', onClick: () => { setHandle(taken.suggest); setTaken(null); } }, '@' + taken.suggest))
                  : '@' + bare + ' is free ✦ your key will be saved to this device')
              : '3–20 characters: letters, numbers, dots, dashes')
      : null,

    mode === 'restore'
      ? h('input', {
          class: 'field', type: 'password', value: key,
          placeholder: 'Account key — shown on your old device',
          onInput: (e) => setKey(e.currentTarget.value)
        })
      : null,

    mode === 'new' && valid
      ? h('div', { class: 'idpreview' },
          h('span', { class: 'avatar glow' }, symbol),
          h('div', { class: 'idpreviewtxt' },
            h('strong', null, bare),
            h('span', { class: 'sub' }, '@' + bare + '  ' + symbol)
          )
        )
      : null,

    err ? h('p', { class: 'beta' }, err) : null,

    h('button', { class: 'btn primary', disabled: !valid || busy, onClick: tryIt },
      busy ? 'casting…' : mode === 'restore' ? 'Restore glyph' : 'Claim ' + symbol),

    h('div', { class: 'modeswitch' },
      mode === 'new'
        ? h('button', { class: 'linkish', onClick: () => { setMode('restore'); setErr(''); } }, 'Switched device? Restore your glyph')
        : h('button', { class: 'linkish', onClick: async () => { setMode('new'); setErr(''); } }, 'Create a new glyph instead')
    ),

    h('p', { class: 'foot' },
      connected
        ? 'Live on gliffon — every glyph name is unique, permanently'
        : 'Working offline — your glyph will light up when you connect'
    )
  );
}
