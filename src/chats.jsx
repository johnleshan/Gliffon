import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { store, uid } from './store.js';

const REPLIES = [
  'felt that one ✦',
  'okay that one hit',
  'casting one back soon ♥',
  'this deserves a reel of its own',
  'bookmarking the feeling'
];

export function Chats({ openContactId, setOpenContactId, onCount }) {
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSym, setNewSym] = useState('✦');

  const loadContacts = async () => setContacts(await store.listContacts());

  useEffect(() => {
    (async () => {
      await loadContacts();
      if (openContactId) setMessages(await store.listMessages(openContactId));
      onCount(0);
    })();
  }, [openContactId]);

  const active = contacts.find((c) => c.id === openContactId);

  const send = async () => {
    if (!draft.trim() || !active) return;
    await store.addMessage({ id: uid(), contactId: active.id, from: 'me', text: draft.trim(), created: Date.now() });
    setMessages(await store.listMessages(active.id));
    setDraft('');
    // Offline preview: an auto-response so the chat feels alive until sync is live.
    setTimeout(async () => {
      await store.addMessage({
        id: uid(), contactId: active.id, from: 'them',
        text: REPLIES[Math.floor(Math.random() * REPLIES.length)], created: Date.now()
      });
      setMessages(await store.listMessages(active.id));
    }, 1200 + Math.random() * 1500);
  };

  if (adding) {
    return h('section', { class: 'chats' },
      h('div', { class: 'card sheet' },
        h('h3', null, 'Add contact'),
        h('input', {
          class: 'field', placeholder: 'Their name', value: newName, maxLength: 30,
          onInput: (e) => setNewName(e.currentTarget.value)
        }),
        h('div', { class: 'symgrid' },
          ['✦', '❋', '◈', '☾', '✧', '⟡'].map((s) =>
            h('button', { key: s, class: 'sym' + (newSym === s ? ' picked' : ''), onClick: () => setNewSym(s) }, s)
          )
        ),
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', onClick: () => setAdding(false) }, 'Cancel'),
          h('button', {
            class: 'btn primary', disabled: !newName.trim(),
            onClick: async () => {
              await store.addContact({ id: uid(), name: newName.trim(), symbol: newSym, added: Date.now() });
              setNewName(''); setAdding(false);
              await loadContacts();
            }
          }, 'Add')
        )
      )
    );
  }

  if (!active) {
    return h('section', { class: 'chats' },
      h('button', { class: 'btn primary', onClick: () => setAdding(true) }, '+ New chat'),
      contacts.length === 0
        ? h('p', { class: 'empty' }, 'No conversations yet. Add a contact to start.')
        : contacts.map((c) =>
            h('button', { class: 'contact card', key: c.id, onClick: () => setOpenContactId(c.id) },
              h('span', { class: 'avatar mini' }, c.symbol),
              h('b', null, c.name),
              h('span', { class: 'chev' }, '›')
            )
          )
    );
  }

  return h('section', { class: 'chats' },
    h('div', { class: 'chathead' },
      h('button', { class: 'btn ghost', onClick: () => setOpenContactId(null) }, '‹'),
      h('span', { class: 'avatar mini' }, active.symbol),
      h('b', null, active.name)
    ),
    h('div', { class: 'bubbles' },
      messages.map((m) =>
        h('div', { class: `bubble ${m.from}` + (m.id.endsWith('demo') ? ' demo' : ''), key: m.id },
          m.text,
          h('small', null, new Date(m.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        )
      ),
      messages.length === 0 ? h('p', { class: 'empty' }, `Say something to ${active.name}`) : null
    ),
    h('div', { class: 'composer-row' },
      h('input', {
        class: 'field slim', placeholder: 'Message…', value: draft,
        onInput: (e) => setDraft(e.currentTarget.value),
        onKeyDown: (e) => { if (e.key === 'Enter') send(); }
      }),
      h('button', { class: 'btn primary send', onClick: send }, '➤')
    )
  );
}
