import { conn, bind, json } from './_db.js';

export default bind(async (req, res) => {
  const { id } = req.params || {};
  if (!id) return json(res, { error: 'id required' }, 400);
  const sql = conn();
  const wall = await sql`
    select w.*, u.name as author_name, u.symbol as author_symbol, u.glyphname as author_handle
    from wall w left join users u on u.id = w.author
    where w.id = ${id} limit 1`;
  if (!wall.length) return json(res, { error: 'not found' }, 404);
  const w = wall[0];
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta property="og:title" content="${w.label || 'Gliffon Glyph'}">
    <meta property="og:description" content="${w.author_name || 'shared a glyph'} on Gliffon">
    <meta property="og:url" content="https://gliffon.vercel.app/g/${id}">
    <meta property="og:type" content="article">
    <meta property="og:image" content="https://gliffon.vercel.app/icon.svg">
    <meta name="twitter:card" content="summary_large_image">
    <title>${w.label || 'Gliffon Glyph'}</title>
  </head>
  <body style="font-family:system-ui,Arial,sans-serif;padding:2rem;text-align:center;">
    <h1>${w.label || 'A Glyph'}</h1>
    <div style="font-size:4rem;">${w.symbol}</div>
    <p>${w.author_name || 'shared on Gliffon'}</p>
    <p style="margin-top:2rem;"><a href="https://gliffon.vercel.app" style="color:#666;">gliffon.vercel.app</a></p>
  </body>
</html>`;
  res.setHeader('content-type', 'text/html');
  res.end(html);
});