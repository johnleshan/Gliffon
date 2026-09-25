import { conn, bind, json } from './_db.js';

// Lightweight delta feed for near-realtime updates (no reloads).
export default bind(async (req, res) => {
  const sql = conn();
  const url = new URL(req.url, 'http://x');

  const me = url.searchParams.get('me'); // my user id (optional)
  const afterMs = parseInt(url.searchParams.get('after') || '0', 10);
  const after = afterMs ? new Date(afterMs).toISOString() : null;

  // wall+authors join (fully qualified so `id` is unambiguous)
  const wall = await sql`
    select wall.id, wall.likes, wall.created, wall.kind, wall.symbol, wall.label, wall.note, wall.author,
           u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
    from wall left join users u on u.id = wall.author
    order by wall.created desc limit 100`;

  // messages involving me created after transient cursor
  let msgs = [];
  if (me && after) {
    msgs = await sql`
      select m.id, m.conv, m.sender, m.text, m.created, u.name as sender_name
      from messages m left join users u on u.id = m.sender
      where m.created > ${after} and m.conv like ${'%' + me + '%'}
      and m.sender <> ${me}
      order by m.created desc limit 50`;
  } else {
    msgs = [];
  }

  // presence: everyone seen in the last 3 minutes
  const presence = await sql`
    select id, extract(epoch from now() - seen) as secs_ago
    from users
    where seen > now() - interval '3 minutes'
    limit 300`;

  // who recently liked MY wall posts (for the owner notification)
  let liked = [];
  if (me && after) {
    liked = await sql`
      select l.wall_id, l.created, u.name as liker_name, u.symbol as liker_symbol, u.glyphname as liker_handle, w.label as glyph_label
      from likes l
      join wall w on w.id = l.wall_id
      join users u on u.id = l.user_id
      where w.author = ${me} and l.created > ${after} and l.user_id <> ${me}
      order by l.created desc limit 50`;
  }

  return json(res, { wall, msgs, liked, online: presence });
});
