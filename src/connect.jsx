import { h } from 'preact';
import { useState } from 'preact/hooks';
import { saveBackendConfig, clearBackendConfig } from './backend.js';

export function ConnectSheet({ connected, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');

  return h('div', { class: 'share-sheet', onClick: onClose },
    h('div', { class: 'sheet glass', onClick: (e) => e.stopPropagation() },
      h('h3', null, connected ? 'Connected' : 'Connect people'),
      connected
        ? h('p', { class: 'sub' }, 'You are connected. Chats and the Wall are live across devices.')
        : h('p', { class: 'sub' }, 'Gliffon goes live with your own free Supabase project (No paid plan, no card).'),
      h('ol', { class: 'steps' },
        h('li', null, 'Create a free project at ', h('b', null, 'supabase.com')),
        h('li', null, 'Run ', h('b', null, 'supabase.sql'), ' (from the repo) in the SQL editor'),
        h('li', null, 'Paste the Project URL + anon key below')
      ),
      !connected ? null : (
        h('button', {
          class: 'btn ghost', onClick: () => {
            clearBackendConfig();
            location.reload();
          }
        }, 'Disconnect')
      ),
      connected ? null : h('div', null,
        h('input', { class: 'field', placeholder: 'https://xxxx.supabase.co', value: url, onInput: (e) => setUrl(e.currentTarget.value) }),
        h('input', { class: 'field', placeholder: 'anon public key', value: key, onInput: (e) => setKey(e.currentTarget.value) }),
        err ? h('p', { class: 'empty' }, err) : null,
        h('button', {
          class: 'btn primary',
          disabled: !url.trim() || !key.trim(),
          onClick: () => {
            saveBackendConfig(url, key);
            onSaved();
          }
        }, 'Connect ✦')
      )
    )
  );
}
