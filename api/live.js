import { conn, bind, json, authUser } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  const url = new URL(req.url, 'http://x');

  // For backwards compat with unauthenticated initial load
  const meId = url.searchParams.get('me') || (me && me.id);
  const afterMs = parseInt(url.searchParams.get('after') || '0', 10);
  const after = afterMs ? new Date(afterMs).toISOString() : null;

  // wall+authors join
  const wall = await sql`
    select wall.id, wall.likes, wall.created, wall.kind, wall.symbol, wall.label, wall.note, wall.author,
           u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
    from wall left join users u on u.id = wall.author
    order by wall.created desc limit 100`;

  // messages involving me created after cursor
  let msgs = [];
  if (meId && after) {
    msgs = await sql`
      select m.id, m.conv, m.sender, m.text, m.created,
             u.name as sender_name, u.symbol as sender_symbol, u.glyphname as sender_handle
      from messages m left join users u on u.id = m.sender
      where m.created > ${after} and m.conv like ${'%' + meId + '%'}
      and m.sender <> ${meId}
      order by m.created desc limit 50`;
  }

  // presence: everyone seen in last 3 minutes
  const presence = await sql`
    select id, extract(epoch from now() - seen) as secs_ago
    from users where seen > now() - interval '3 minutes' limit 300`;

  // who recently liked MY wall posts
  let liked = [];
  if (meId && after) {
    liked = await sql`
      select l.wall_id, l.created, u.name as liker_name, u.symbol as liker_symbol, u.glyphname as liker_handle, w.label as glyph_label
      from likes l
      join wall w on w.id = l.wall_id
      join users u on u.id = l.user_id
      where w.author = ${meId} and l.created > ${after} and l.user_id <> ${meId}
      order by l.created desc limit 50`;
  }

  // recent comments on MY wall posts (for in-app notification)
  let commented = [];
  if (meId && after) {
    commented = await sql`
      select c.wall_id, c.created, u.name as commenter_name, u.symbol as commenter_symbol, u.glyphname as commenter_handle, w.label as glyph_label, c.text as comment_text
      from comments c
      join wall w on w.id = c.wall_id
      join users u on u.id = c.author
      where w.author = ${meId} and c.created > ${after} and c.author <> ${meId}
      order by c.created desc limit 50`;
  }

  return json(res, { wall, msgs, liked, commented, online: presence });
});