import { h } from 'preact';
import { useState } from 'preact/hooks';
import { saveBackendConfig, getBackendConfig, clearBackendConfig } from './backend.js';

export function ConnectSheet({ connected, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  return h('div', { class: 'share-sheet', onClick: onClose },
    h('div', { class: 'sheet glass', onClick: (e) => e.stopPropagation() },
      h('h3', null, connected ? 'Connected ✓' : 'Connect'),
      connected
        ? h('p', { class: 'sub' }, `Live at ${getBackendConfig().url}. Chats and the Wall are synced across devices.`)
        : h('p', { class: 'sub' }, 'Paste the URL of your deployed Glifon (from `vercel --prod`). Leave blank to use same-origin.'),
      !connected ? null : (
        h('button', {
          class: 'btn ghost', onClick: () => {
            clearBackendConfig();
            location.reload();
          }
        }, 'Disconnect')
      ),
      connected ? null : h('div', null,
        h('input', {
          class: 'field',
          placeholder: 'https://gliffon.vercel.app  (same-origin if blank)',
          value: url,
          onInput: (e) => setUrl(e.currentTarget.value)
        }),
        err ? h('p', { class: 'empty' }, err) : null,
        h('button', {
          class: 'btn primary',
          onClick: () => {
            if (url.trim() === '') saveBackendConfig(''); // same-origin
            else if (!/^https?:\/\//.test(url.trim())) { setErr('URL must start with http(s)://'); return; }
            else saveBackendConfig(url);
            onSaved();
          }
        }, 'Connect ✦')
      ),
      h('p', { class: 'sub steps' }, 'Neon console → run neon-schema.sql · Vercel → env DATABASE_URL · deploy.')
    )
  );
}
