import { conn, bind, json, readBody, authUser, rate } from './_db.js';

export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'event', max: 300, windowMs: 60000 })) return;
    const b = await readBody(req);
    if (!b.name) return json(res, { error: 'name required' }, 400);
    await sql`insert into events (user_id, name, meta) values (${me.id}, ${b.name}, ${JSON.stringify(b.meta || {})})`;
    return json(res, { ok: true });
  }

  // Aggregate analytics, scoped to the caller's own activity.
  if (req.method === 'GET') {
    const byDay = await sql`
      select to_char(date_trunc('day', created), 'YYYY-MM-DD') as day, count(*)::int as count
      from events
      where user_id = ${me.id} and created > now() - interval '30 days'
      group by 1 order by 1`;

    const byName = await sql`
      select name, count(*)::int as count
      from events where user_id = ${me.id}
      group by name order by count desc limit 20`;

    const totals = await sql`
      select
        (select count(*)::int from wall where author = ${me.id}) as casts,
        (select coalesce(sum(likes), 0)::int from wall where author = ${me.id}) as likes_received,
        (select count(*)::int from comments c join wall w on w.id = c.wall_id where w.author = ${me.id}) as comments_received,
        (select count(*)::int from follows where followee = ${me.id}) as followers,
        (select count(*)::int from follows where follower = ${me.id}) as following`;

    return json(res, {
      byDay,
      byName,
      totals: totals[0] || { casts: 0, likes_received: 0, comments_received: 0, followers: 0, following: 0 }
    });
  }

  return json(res, { error: 'method' }, 405);
});