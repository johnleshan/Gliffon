import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { store, uid } from './store.js';
import { backend, getMyId, at } from './backend.js';

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

export function Chats({
  profile, contacts, openChat, setOpenChat, unread, setUnread,
  liveMsg, setLiveMsg, onlineIds, backendOK, backend, event
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(undefined);
  const [err, setErr] = useState('');
  const [typingId, setTypingId] = useState(null);
  const bubbleBox = useRef(null);
  const myId = getMyId();

  const loadMsgs = async () => {
    if (!openChat) return setMessages([]);
    if (backendOK && backend) {
      const msgs = await backend.listMessages(openChat);
      // Server rows use `sender`; the local store uses `from: 'me' | 'them'`.
      // Normalising here keeps the bubble rendering single-sourced.
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          text: m.text,
          created: new Date(m.created).getTime(),
          from: m.sender === myId ? 'me' : 'them',
          senderHandle: m.sender_handle,
          senderName: m.sender_name,
          senderSymbol: m.sender_symbol,
          senderId: m.sender
        }))
      );
    } else {
      setMessages(await store.listMessages(openChat));
    }
  };

  useEffect(() => {
    setTypingId(null);
    loadMsgs();
  }, [openChat, backendOK]);

  useEffect(() => {
    if (!liveMsg) return;
    const has = backendOK && backend
      ? (liveMsg.msgs || []).some((m) => m.conv === backend.convKey(openChat))
      : liveMsg.contactId === openChat;
    if (has) loadMsgs();
  }, [liveMsg]);

  useEffect(() => {
    const el = bubbleBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typingId]);

  const active = contacts.find((c) => c.id === openChat);

  const send = async () => {
    if (!draft.trim() || !active) return;
    const text = draft.trim();
    setDraft('');
    if (backendOK && backend) {
      await backend.sendMessage(active.id, text);
      await loadMsgs();
    } else {
      setTypingId(active.id);
      await store.addMessage({ id: uid(), contactId: active.id, from: 'me', text, created: Date.now() });
      await loadMsgs();
      setTimeout(async () => {
        await store.addMessage({
          id: uid(), contactId: active.id, from: 'them',
          text: REPLIES[Math.floor(Math.random() * REPLIES.length)], created: Date.now()
        });
        setTypingId((cur) => (cur === active.id ? null : cur));
        if (openChat === active.id) loadMsgs();
      }, 1400);
    }
  };

  const find = async () => {
    setErr('');
    if (backendOK && backend) {
      const r = await backend.findUser(query.trim());
      setFound(r || null);
      if (!r) event('search_miss', { query: query.trim() });
    } else {
      if (!query.trim()) return;
      await store.addContact({ id: uid(), name: query.trim(), symbol: '✦', added: Date.now() });
      setQuery('');
      setAdding(false);
      // contacts refreshed by parent
    }
  };

  return h('section', { class: 'chats' },
    adding
      ? h('div', { class: 'card sheet' },
          h('h3', null, 'Find someone'),
          h('p', { class: 'sub' }, backendOK ? 'search by glyph name' : 'offline preview — connect on the You tab to find real people'),
          h('input', {
            class: 'field', placeholder: 'their glyph name e.g. nova✦', value: query,
            onInput: (e) => setQuery(e.currentTarget.value)
          }),
          found
            ? h('div', { class: 'contact card' },
                h('span', { class: 'avatar mini' }, found.symbol),
                h('div', null,
                  h('b', null, found.name),
                  h('p', { class: 'sub' }, at(found.glyphname, found.name))
                ),
                h('button', {
                  class: 'btn primary',
                  onClick: () => { setOpenChat(found.id); setAdding(false); }
                }, 'Open chat')
              )
            : null,
          err ? h('p', { class: 'empty' }, err ) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost', onClick: () => { setAdding(false); setErr(''); setFound(undefined); } }, 'Cancel'),
            h('button', {
              class: 'btn primary', disabled: !query.trim(),
              onClick: async () => {
                await find();
                if (!backendOK) setAdding(false);
              }
            }, backendOK ? 'Search' : 'Add')
          )
        )
      : null,
    !openChat && !adding
      ? h('button', { class: 'btn primary', onClick: () => setAdding(true) },
          backendOK ? '+ Find someone' : '+ New chat')
      : null,
    !openChat && !adding
      ? (contacts.length === 0
          ? h('p', { class: 'empty' }, backendOK
              ? 'You are live. Find people by their glyph name.'
              : 'No conversations yet.')
          : contacts.map((c) =>
              h('button', { class: 'contact card', key: c.id, onClick: () => setOpenChat(c.id) },
                h('span', { class: 'avatar mini' }, c.symbol),
                h('b', null, c.name),
                backendOK && onlineIds[c.id]
                  ? h('span', { class: 'dot online', title: 'online' }, '')
                  : backendOK
                    ? h('span', { class: 'dot', title: 'offline' }, '')
                    : null,
                h('span', { class: 'chev' }, '›')
              ))
        )
      : null,
    active
      ? h(Fragment, null,
          h('div', { class: 'chathead' },
            h('button', { class: 'btn ghost', onClick: () => setOpenChat(null) }, '‹'),
            h('span', { class: 'avatar mini' }, active.symbol),
            h('b', null, active.name),
            h('span', {
              class: (backendOK && onlineIds[active.id]) ? 'dot online big' : 'dot big'
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
            typingId === openChat
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