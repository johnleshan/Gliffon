import { openDB, type IDBPDatabase } from 'idb';
import type { Glyph, GlyphKind, Profile } from './types';

export interface Contact {
  id: string;
  name: string;
  symbol: string;
  added: number;
}

export interface Message {
  id: string;
  contactId: string;
  from: 'me' | 'them';
  text: string;
  created: number;
}

interface DBSchema {
  profile: Profile;
  glyphs: Glyph;
  contacts: Contact;
  messages: Message;
}

interface Store {
  getProfile(): Promise<Profile | undefined>;
  saveProfile(p: Profile): Promise<void>;
  clearProfile(): Promise<void>;
  addGlyph(g: Glyph): Promise<void>;
  listGlyphs(): Promise<Glyph[]>;
  deleteGlyph(id: string): Promise<void>;
  listContacts(): Promise<Contact[]>;
  addContact(c: Contact): Promise<void>;
  deleteContact(id: string): Promise<void>;
  listMessages(contactId: string): Promise<Message[]>;
  addMessage(m: Message): Promise<void>;
  likeCount(id: string): Promise<number>;
  like(id: string): Promise<void>;
}

let dbp: Promise<IDBPDatabase<DBSchema>>;

function db() {
  if (!dbp) {
    dbp = openDB<DBSchema>('glifon', 2, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('glyphs')) d.createObjectStore('glyphs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('profile')) d.createObjectStore('profile');
        if (!d.objectStoreNames.contains('contacts')) d.createObjectStore('contacts', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('messages')) d.createObjectStore('messages', { keyPath: 'id' });
      }
    }) as unknown as Promise<IDBPDatabase<DBSchema>>;
  }
  return dbp;
}

// Local-first adapter. Swap with a remote adapter (e.g. Supabase) later.
export const store: Store = {
  async getProfile() {
    return (await db()).get('profile', 'me');
  },
  async saveProfile(p) {
    await (await db()).put('profile', p, 'me');
  },
  async clearProfile() {
    await (await db()).delete('profile', 'me');
    localStorage.removeItem('gliffon.me');
  },
  async addGlyph(g) {
    await (await db()).add('glyphs', g);
  },
  async listGlyphs() {
    const all = await (await db()).getAll('glyphs');
    return all.sort((a, b) => b.created - a.created);
  },
  async deleteGlyph(id) {
    await (await db()).delete('glyphs', id);
  },
  async listContacts() {
    const all = await (await db()).getAll('contacts');
    return all.sort((a, b) => b.added - a.added);
  },
  async addContact(c) {
    await (await db()).add('contacts', c);
  },
  async deleteContact(id) {
    await (await db()).delete('contacts', id);
  },
  async listMessages(contactId) {
    const all = await (await db()).getAll('messages');
    return all.filter((m) => m.contactId === contactId).sort((a, b) => a.created - b.created);
  },
  async addMessage(m) {
    await (await db()).add('messages', m);
  },
  async likeCount(id) {
    const row = await (await db()).get('glyphs', id);
    return row?.likes || 0;
  },
  async like(id) {
    const row = await (await db()).get('glyphs', id);
    if (row) await (await db()).put('glyphs', { ...row, likes: (row.likes || 0) + 1 });
  }
};

export const KINDS: { kind: GlyphKind; name: string; symbols: string[]; words: string[] }[] = [
  { kind: 'love', name: 'Love', symbols: ['💗', '💘', '💞', '🌹'], words: ['held your hand', 'kept your word', 'grew between us', 'wrote itself on me'] },
  { kind: 'mood', name: 'Mood', symbols: ['🌤️', '🌋', '🌊', '🌙', '⚡'], words: ['slow and bright', 'burning through', 'deep under', 'quiet over the city', 'small storms'] },
  { kind: 'memory', name: 'Memory', symbols: ['🕯️', '📸', '🗝️', '🐚'], words: ['a light that would not go out', 'a room we still share', 'the door we closed', 'the sound of that summer'] },
  { kind: 'creativity', name: 'Creativity', symbols: ['✨', '🎨', '🌌', '🧩'], words: ['a trick of the mind', 'still drying somewhere', 'burning quietly outside', 'the missing piece kept talking'] }
];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
