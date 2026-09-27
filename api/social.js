import { conn, bind, json, readBody, authUser, rate } from './_db.js';
import { sendToUser } from './_push.js';

// One function for the whole social graph: follows, blocks, reports.
// ?type=following|followers|blocks&action=follow|unfollow|block|unblock|report
export default bind(async (req, res) => {
  const sql = conn();
  const me = await authUser(sql, req);
  if (!me) return json(res, { error: 'sign in required' }, 401);

  const url = new URL(req.url, 'http://x');
  const type = url.searchParams.get('type') || '';
  const action = url.searchParams.get('action') || '';

  if (req.method === 'GET') {
    if (type === 'followers') {
      const rows = await sql`
        select u.id, u.glyphname, u.name, u.symbol
        from follows f join users u on u.id = f.follower
        where f.followee = ${me.id} order by f.created desc`;
      return json(res, rows);
    }
    if (type === 'blocks') {
      const rows = await sql`
        select u.id, u.glyphname, u.name, u.symbol
        from blocks b join users u on u.id = b.blocked
        where b.blocker = ${me.id} order by b.created desc`;
      return json(res, rows);
    }
    const rows = await sql`
      select u.id, u.glyphname, u.name, u.symbol
      from follows f join users u on u.id = f.followee
      where f.follower = ${me.id} order by f.created desc`;
    return json(res, rows);
  }

  if (req.method === 'POST') {
    if (!rate(req, res, { key: 'social', max: 60, windowMs: 60000 })) return;
    const b = await readBody(req);

    if (action === 'report') {
      if (!b.kind || !b.target_id) return json(res, { error: 'kind and target_id required' }, 400);
      await sql`
        insert into reports (id, reporter, kind, target_id, reason)
        values (${b.id}, ${me.id}, ${b.kind}, ${b.target_id}, ${String(b.reason || '').slice(0, 500)})
        on conflict (id) do nothing`;
      return json(res, { ok: true });
    }

    if (!b.glyphname) return json(res, { error: 'glyphname required' }, 400);
    const rows = await sql`select id from users where lower(glyphname) = ${String(b.glyphname).trim().toLowerCase()} limit 1`;
    if (!rows.length) return json(res, { error: 'no such glyph name' }, 404);
    const targetId = rows[0].id;
    if (targetId === me.id) return json(res, { error: "can't do that to yourself" }, 400);

    if (action === 'follow') {
      await sql`insert into follows (follower, followee) values (${me.id}, ${targetId}) on conflict do nothing`;
      sendToUser(sql, targetId, {
        title: `${me.glyphname} is now following you`,
        body: `${me.symbol} new follower`,
        icon: '/icon.svg',
        data: { url: '/' }
      }).catch(() => {});
      return json(res, { ok: true });
    }
    if (action === 'block') {
      await sql`insert into blocks (blocker, blocked) values (${me.id}, ${targetId}) on conflict do nothing`;
      return json(res, { ok: true });
    }
    return json(res, { error: 'unknown action' }, 400);
  }

  if (req.method === 'DELETE') {
    const b = await readBody(req);
    if (action === 'report') return json(res, { error: 'not supported' }, 400);
    if (!b.glyphname) return json(res, { error: 'glyphname required' }, 400);
    const rows = await sql`select id from users where lower(glyphname) = ${String(b.glyphname).trim().toLowerCase()} limit 1`;
    if (!rows.length) return json(res, { error: 'no such glyph name' }, 404);
    const targetId = rows[0].id;
    if (action === 'unfollow') {
      await sql`delete from follows where follower = ${me.id} and followee = ${targetId}`;
      return json(res, { ok: true });
    }
    if (action === 'unblock') {
      await sql`delete from blocks where blocker = ${me.id} and blocked = ${targetId}`;
      return json(res, { ok: true });
    }
    return json(res, { error: 'unknown action' }, 400);
  }

  return json(res, { error: 'method' }, 405);
});
