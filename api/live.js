import { conn, bind, json, authUser } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  const url = new URL(req.url, 'http://x');

  // Identity is always server-derived from the auth token. We never trust a
  // caller-supplied ?me= param, otherwise anyone could read another user's DMs.
  const meId = me && me.id;
  const afterMs = parseInt(url.searchParams.get('after') || '0', 10);
  const after = afterMs ? new Date(afterMs).toISOString() : null;

  // wall + authors, with a live comment count so counters stay accurate
  // without anyone having to open the comments panel.
  const wall = await sql`
    select wall.id, wall.likes, wall.created, wall.kind, wall.symbol, wall.label, wall.note, wall.author,
           u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle,
           (select count(*)::int from comments c where c.wall_id = wall.id) as comments
    from wall left join users u on u.id = wall.author
    order by wall.created desc limit 100`;

  // Messages involving me created after the cursor.
  // conv is exactly "<idA>|<idB>". A message is mine when conv starts with my
  // id or ends with "|<myid>". This is exact set membership, so a user whose id
  // is a substring of someone else's id never receives phantom messages.
  let msgs = [];
  if (meId && after) {
    msgs = await sql`
      select m.id, m.conv, m.sender, m.text, m.created,
             u.name as sender_name, u.symbol as sender_symbol, u.glyphname as sender_handle
      from messages m left join users u on u.id = m.sender
      where m.created > ${after}
        and m.sender <> ${meId}
        and (m.conv = ${meId} || '|' || right(m.conv, length(m.conv) - length(${meId}) - 1)
             or m.conv = left(m.conv, length(m.conv) - length(${meId}) - 1) || '|' || ${meId})
      order by m.created desc limit 50`;
  }

  // Conversation list for this user, newest first, with the last message in
  // each. distinct on keeps one row per conversation while still taking the
  // most recent message's text/sender. The peer's identity is resolved
  // server-side so the client can label the row with the other person even
  // when the last message happened to be mine.
  const conversations = meId ? await sql`
    select distinct on (m.conv)
           m.conv, m.created as last_at, m.text as last_text, m.sender as last_sender,
           pu.glyphname as peer_handle, pu.name as peer_name, pu.symbol as peer_symbol
    from messages m
    left join users pu on pu.id = (
      select c2 from unnest(string_to_array(m.conv, '|')) as c2
      where c2 <> ${meId} limit 1)
    where m.conv = ${meId} || '|' || right(m.conv, length(m.conv) - length(${meId}) - 1)
       or m.conv = left(m.conv, length(m.conv) - length(${meId}) - 1) || '|' || ${meId}
    order by m.conv, m.created desc` : [];

  // Order the result set by recency (distinct on forces conv as the key).
  conversations.sort((a, b) => new Date(b.last_at) - new Date(a.last_at));

  // Per-conversation read markers.
  const read = meId
    ? await sql`select conv, read_at from conv_reads where user_id = ${meId}`
    : [];

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

  return json(res, { wall, msgs, liked, commented, online: presence, conversations, read });
});