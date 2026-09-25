import { conn, bind, json } from './_db.js';

// Record a unique like and bump the wall counter only for novel likes.
export default bind(async (req, res) => {
  const sql = conn();
  if (req.method !== 'POST') return json(res, { error: 'method' }, 405);

  const b = await new Promise((ok, err) => {
    let x = '';
    req.on('data', (c) => (x += c));
    req.on('end', () => { try { ok(JSON.parse(x)); } catch (e) { err(new Error('bad json')); } });
  });
  if (!b.wall_id || !b.user_id) return json(res, { error: 'wall_id and user_id required' }, 400);

  const exists = await sql`select 1 from likes where wall_id = ${b.wall_id} and user_id = ${b.user_id}`;
  if (exists.length) return json(res, { ok: true, already: true });

  await sql`insert into likes (wall_id, user_id) values (${b.wall_id}, ${b.user_id})`;
  await sql`update wall set likes = likes + 1 where id = ${b.wall_id}`;
  return json(res, { ok: true });
});
