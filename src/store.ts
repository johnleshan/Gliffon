import { openDB, type IDBPDatabase } from 'idb';
import type { Glyph, GlyphKind, Profile } from './types';

interface DBSchema {
  profile: Profile;
  glyphs: Glyph;
}

interface Store {
  getProfile(): Promise<Profile | undefined>;
  saveProfile(p: Profile): Promise<void>;
  addGlyph(g: Glyph): Promise<void>;
  listGlyphs(): Promise<Glyph[]>;
  deleteGlyph(id: string): Promise<void>;
}

let dbp: Promise<IDBPDatabase<DBSchema>>;

function db() {
  if (!dbp) {
    dbp = openDB<DBSchema>('glifon', 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('glyphs')) d.createObjectStore('glyphs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('profile')) d.createObjectStore('profile');
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
  async addGlyph(g) {
    await (await db()).add('glyphs', g);
  },
  async listGlyphs() {
    const all = await (await db()).getAll('glyphs');
    return all.sort((a, b) => b.created - a.created);
  },
  async deleteGlyph(id) {
    await (await db()).delete('glyphs', id);
  }
};

export const KINDS: { kind: GlyphKind; name: string; symbols: string[] }[] = [
  { kind: 'love', name: 'Love', symbols: ['💗', '💘', '🫶', '🌹'] },
  { kind: 'mood', name: 'Mood', symbols: ['🌤️', '🌋', '🌊', '🌙', '⚡'] },
  { kind: 'memory', name: 'Memory', symbols: ['🕯️', '📸', '🗝️', '🐚'] },
  { kind: 'creativity', name: 'Creativity', symbols: ['🪄', '🎨', '🌌', '🧩'] }
];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
