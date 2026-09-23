import { createClient } from '@supabase/supabase-js';
import { uid } from './store.js';

// Config stored locally so each user connects their own free Supabase project.
const CONFIG_KEY = 'gliffon.backend';

export const getBackendConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveBackendConfig = (url, anonKey) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
};

export const clearBackendConfig = () => localStorage.removeItem(CONFIG_KEY);

let client = null;
const me = { id: null };

export const backend = (() => {
  const cfg = getBackendConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.anonKey);
  try { me.id = JSON.parse(localStorage.getItem('gliffon.me')); } catch { me.id = null; }
  return {
    online: true,
    async ensureUser(profile) {
      let user = null;
      if (me.id) {
        user = await this.getUserById(me.id);
      }
      if (!user) user = await this.findUser(profile.glyphName);
      if (!user) {
        const { data, error } = await client.from('users').insert({
          glyphname: profile.glyphName, name: profile.name, symbol: profile.symbol || '✦'
        }).select().single();
        if (error) throw error;
        user = data;
      }
      me.id = user.id;
      localStorage.setItem('gliffon.me', JSON.stringify(user.id));
      return user;
    },
    async getUserById(id) {
      const { data } = await client.from('users').select().eq('id', id).maybeSingle();
      return data;
    },
    async findUser(glyphname) {
      const { data } = await client.from('users').select().eq('glyphname', glyphname).maybeSingle();
      return data;
    },
    async listUsers() {
      const { data } = await client.from('users').select('id, name, glyphname, symbol').order('glyphname').limit(200);
      return data || [];
    },
    async listWall() {
      const { data, error } = await client
        .from('wall')
        .select()
        .order('created', { ascending: false })
        .limit(300);
      if (error) return [];
      return data || [];
    },
    async addToWall(g) {
      const { error } = await client.from('wall').insert({
        kind: g.kind, symbol: g.symbol, label: g.label, note: g.note || null,
        likes: 0, author: me.id
      });
      return !error;
    },
    async likeWall(wallId) {
      const { error } = await client.rpc('bump_like', { row_id: wallId });
      return !error;
    },
    convKey(friendId) {
      return [me.id, friendId].sort().join('|');
    },
    async listMessages(friendId) {
      const { data } = await client.from('messages')
        .select()
        .eq('conv', this.convKey(friendId))
        .order('created', { ascending: true })
        .limit(400);
      return (data || []).map((x) => ({
        id: x.id, contactId: friendId, from: x.sender === me.id ? 'me' : 'them', text: x.text, created: x.created
      }));
    },
    async sendMessage(friendId, text) {
      const { error } = await client.from('messages').insert({
        conv: this.convKey(friendId), sender: me.id, text
      });
      return !error;
    },
    subscribe(onWall, onMessage) {
      client.channel('gliffon-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wall' }, (p) => onWall(p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onMessage(p.new))
        .subscribe();
    }
  };
})();

export const myId = () => me.id;
