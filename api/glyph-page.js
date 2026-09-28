import { conn, bind } from './_db.js';

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Server-rendered share page. Social crawlers do not execute JS, so the OG tags
// have to exist in the initial HTML response. Everything interpolated here is
// user-authored, so it is escaped before it reaches the document.
export default bind(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('id');
  if (!id) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><meta charset="utf-8"><p>Missing glyph id.</p>');
  }

  let row = null;
  try {
    const sql = conn();
    const rows = await sql`
      select w.id, w.label, w.symbol, w.note, w.likes, w.created,
             u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
      from wall w left join users u on u.id = w.author
      where w.id = ${id} limit 1`;
    row = rows[0] || null;
  } catch {
    row = null;
  }

  const site = 'https://gliffon.vercel.app';
  const title = row ? `${row.symbol} ${row.label || 'A glyph'}` : 'Gliffon';
  const who = row ? row.author_handle || row.author_name || 'someone' : 'Gliffon';
  const desc = row
    ? `${who} cast this glyph on Gliffon — say it in symbols. ${row.likes || 0} likes`
    : 'Gliffon is where symbols breathe. A living diary of glyphs — say it in symbols.';

  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${esc(title)} · Gliffon</title>
    <meta name="description" content="${esc(desc)}">
    <meta property="og:site_name" content="Gliffon">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${esc(site + '/g/' + id)}">
    <meta property="og:type" content="article">
    <meta property="og:image" content="${esc(site + '/icon.svg')}">
    <meta name="twitter:card" content="summary">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070b18;color:#eef2ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;padding:2rem">
    <main>
      <div style="font-size:5rem;line-height:1;background:radial-gradient(circle at 50% 42%, rgb(139 123 255 / .22), transparent 65%);border-radius:50%">${esc(row ? row.symbol : '◈')}</div>
      <h1 style="font-size:1.75rem;margin:1rem 0 .35rem">${esc(row ? row.label || 'A glyph' : 'This glyph is no longer available')}</h1>
      <p style="color:#ffc46b;margin:0 0 .35rem">${esc(row ? (row.author_symbol || '✦') + ' ' + who : 'Gliffon')}</p>
      <p style="color:#9fadd0;margin:0">${esc(row ? row.likes + ' likes' : 'Say it in symbols.')}</p>
      <a href="${esc(site)}" style="display:inline-block;margin-top:1.75rem;padding:.7rem 1.4rem;border-radius:999px;background:linear-gradient(135deg,#8b7bff,#ff5d9f);color:#fff;text-decoration:none;font-weight:600">Cast yours on Gliffon</a>
      <p style="color:#6d7aa3;font-size:.8rem;margin-top:1.5rem">Gliffon is where symbols breathe.</p>
    </main>
  </body>
</html>`);
});
