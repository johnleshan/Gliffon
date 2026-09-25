import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { store, uid } from './store.js';
import { backend, myId } from './backend.js';

const DAY_FMT = new Intl.DateTimeFormat([], { day: 'numeric', month: 'short' });
const dayLabel = (t) => {
  const d = new Date(t);
  const today = new Date();
  const yes = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yes.toDateString()) return 'Yesterday';
  return DAY_FMT.format(d);
};

const REPLIES = [
  'felt that one ✦',
  'okay that one hit',
  'casting one back soon ♥',
  'this deserves a reel of its own',
  'bookmarking the feeling'
];

export function Chats({ openContactId, setOpenContactId, refreshContacts, connected, liveMsg, onlineIds, notify }) {
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(undefined);
  const [err, setErr] = useState('');
  const [typingId, setTypingId] = useState(null);
  const bubbleBox = useRef(null);
  const loadContacts = async () => {
    if (connected) {
      const rows = await backend.listUsers();
      setContacts(rows.filter((r) => r.id !== myId()));
    } else {
      setContacts(await store.listContacts());
    }
  };

  const loadMsgs = async () => {
    if (!openContactId) return setMessages([]);
    setMessages(connected
      ? await backend.listMessages(openContactId)
      : await store.listMessages(openContactId));
  };

  useEffect(() => {
    setTypingId(null);
    (async () => {
      await loadContacts();
      await loadMsgs();
    })();
  }, [openContactId, connected]);

  // incoming live messages: refresh the open conversation
  useEffect(() => {
    if (!liveMsg) return;
    const has = connected
      ? (liveMsg.msgs || []).some((m) => m.conv === backend.convKey(openContactId))
      : liveMsg.contactId === openContactId;
    if (has) loadMsgs();
  }, [liveMsg]);

  // keep the stack glued to the newest bubble
  useEffect(() => {
    const el = bubbleBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typingId]);

  const active = contacts.find((c) => c.id === openContactId);

  const send = async () => {
    if (!draft.trim() || !active) return;
    const text = draft.trim();
    setDraft('');
    if (connected) {
      await backend.sendMessage(active.id, text);
      await loadMsgs();
    } else {
      setTypingId(active.id); // optimistic "typing…" hint, cleared when the reply lands
      await store.addMessage({ id: uid(), contactId: active.id, from: 'me', text, created: Date.now() });
      await loadMsgs();
      setTimeout(async () => {
        await store.addMessage({
          id: uid(), contactId: active.id, from: 'them',
          text: REPLIES[Math.floor(Math.random() * REPLIES.length)], created: Date.now()
        });
        setTypingId((cur) => (cur === active.id ? null : cur));
        if (openContactId === active.id) loadMsgs();
      }, 1400);
    }
  };

  const find = async () => {
    setErr('');
    if (connected) {
      const r = await backend.findUser(query.trim());
      setFound(r || null);
      if (!r) notify(`No one is using ${query.trim()}`);
    } else {
      if (!query.trim()) return;
      await store.addContact({ id: uid(), name: query.trim(), symbol: '✦', added: Date.now() });
      setQuery('');
      setAdding(false);
      await loadContacts();
      if (refreshContacts) refreshContacts();
    }
  };

  return h('section', { class: 'chats' },
    adding
      ? h('div', { class: 'card sheet' },
          h('h3', null, 'Find someone'),
          h('p', { class: 'sub' }, connected ? 'search by glyph name' : 'offline preview — connect on the You tab to find real people'),
          h('input', {
            class: 'field', placeholder: 'their glyph name e.g. nova✦', value: query,
            onInput: (e) => setQuery(e.currentTarget.value)
          }),
          found
            ? h('div', { class: 'contact card' },
                h('span', { class: 'avatar mini' }, found.symbol),
                h('div', null,
                  h('b', null, found.name),
                  h('p', { class: 'sub' }, `@${found.glyphname}`)
                ),
                h('button', {
                  class: 'btn primary',
                  onClick: () => { setOpenContactId(found.id); setAdding(false); }
                }, 'Open chat')
              )
            : null,
          err ? h('p', { class: 'empty' }, err) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost', onClick: () => { setAdding(false); setErr(''); setFound(undefined); } }, 'Cancel'),
            h('button', {
              class: 'btn primary', disabled: !query.trim(),
              onClick: async () => {
                await find();
                if (!connected) setAdding(false);
              }
            }, connected ? 'Search' : 'Add')
          )
        )
      : null,
    !openContactId && !adding
      ? h('button', { class: 'btn primary', onClick: () => setAdding(true) },
          connected ? '+ Find someone' : '+ New chat')
      : null,
    !openContactId && !adding
      ? (contacts.length === 0
          ? h('p', { class: 'empty' }, connected
              ? 'You are live. Find people by their glyph name.'
              : 'No conversations yet.')
          : contacts.map((c) =>
              h('button', { class: 'contact card', key: c.id, onClick: () => setOpenContactId(c.id) },
                h('span', { class: 'avatar mini' }, c.symbol),
                h('b', null, c.name),
                connected && onlineIds[c.id]
                  ? h('span', { class: 'dot online', title: 'online' }, '')
                  : connected
                    ? h('span', { class: 'dot', title: 'offline' }, '')
                    : null,
                h('span', { class: 'chev' }, '›')
              ))
         )
      : null,
    active
      ? h(h.Fragment, null,
          h('div', { class: 'chathead' },
            h('button', { class: 'btn ghost', onClick: () => setOpenContactId(null) }, '‹'),
      h('span', { class: 'avatar mini' }, active.symbol),
      h('b', null, active.name),
      h('span', {
        class: (connected && onlineIds[active.id]) ? 'dot online big' : 'dot big'
      })
    ),
          h('div', { class: 'bubbles', ref: bubbleBox },
            (() => {
              let prevMsg = null;
              return messages.map((m) => {
                const t = new Date(m.created);
                const newDay = !prevMsg || new Date(prevMsg.created).toDateString() !== t.toDateString();
                const ditto = !newDay && prevMsg && prevMsg.from === m.from && m.created - prevMsg.created < 3 * 60000;
                prevMsg = m;
                const time = ` ${new Date(m.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                const tick = m.from === 'me' && Date.now() - m.created > 2200 ? ' ✓✓' : (m.from === 'me' ? ' ✓' : '');
                return [
                  newDay ? h('div', { class: 'daysep', key: 'd' + m.id }, dayLabel(m.created)) : null,
                  h('div', {
                    class: `bubble ${m.from}${ditto ? ' ditto' : ''}`,
                    key: m.id
                  },
                    m.text,
                    h('small', null, time.slice(1) + tick)
                  )
                ];
              });
            })(),
            messages.length === 0 ? h('p', { class: 'empty' }, `say something to ${active.name}`) : null,
            typingId === openContactId
              ? h('div', { class: 'bubble them typing', 'aria-label': 'typing' },
                  h('span', { class: 'tdot' }), h('span', { class: 'tdot' }), h('span', { class: 'tdot' }))
              : null
          ),
          h('div', { class: 'composer-row' },
            h('input', {
              class: 'field slim', placeholder: 'message…', value: draft,
              onInput: (e) => setDraft(e.currentTarget.value),
              onKeyDown: (e) => { if (e.key === 'Enter') send(); }
            }),
            h('button', { class: 'btn primary send', onClick: send }, '➤')
          )
        )
      : null
  );
}
