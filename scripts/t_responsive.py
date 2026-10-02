import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
PROD = 'https://gliffon.vercel.app'
TABS = ['Reels', 'Glyphs', 'Paint', 'Chats', 'Pulse', 'Profile']
VPS = [(320, 700, 'n320'), (360, 780, 'n360'), (390, 780, 'n390'), (768, 900, 'd768'), (1366, 768, 'd1366')]
errs = []

# an element that sticks wider than the viewport horizontally
OVERFLOW_JS = """() => {
  const bad = [];
  const vw = document.documentElement.clientWidth;
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 8 && (r.right > vw + 1 || r.left < -1) && !el.closest('.reels') && !el.classList.contains('reels')) {
      // full-bleed reels scroll container is expected to span exactly vw
      if (Math.abs(el.getBoundingClientRect().width - vw) < 2) return;
      if (['HTML', 'BODY', '#APP'].includes(el.tagName) || el.id === 'app') return;
      bad.push(el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.split(' ')[0] + '@' + Math.round(r.right) : el.tagName.toLowerCase());
    }
  });
  const doc = document.documentElement.scrollWidth - vw;
  return { doc, bad: [...new Set(bad)].slice(0, 6) };
}"""

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    for w, h, tag in VPS:
        a = br.new_context(viewport={'width': w, 'height': h}).new_page()
        a.on('pageerror', lambda e: errs.append(str(e)))
        a.goto(PROD, wait_until='networkidle'); a.wait_for_timeout(2200)
        a.locator('.authtabs button', has_text='Sign in').click(); a.wait_for_timeout(300)
        a.locator('.claimwrap input').first.fill('john')
        a.locator('input[type=password]').fill('john@123')
        a.locator('button[type=submit]').click(); a.wait_for_timeout(3500)
        for t in TABS:
            loc = a.locator('.tabs button', has_text=t)
            if loc.count(): loc.first.click(); a.wait_for_timeout(900)
            o = a.evaluate(OVERFLOW_JS)
            status = 'ok' if o['doc'] <= 0 and not o['bad'] else f"OVERFLOW doc+{o['doc']}px bad={','.join(o['bad'])}"
            print(f'{tag} ({w}x{h}) {t}: {status}')
            if o['doc'] > 0 or o['bad']:
                a.screenshot(path=f'{out}/rsp-{tag}-{t.lower()}.png')
        a.close()
    print('errors:', errs or 'none')
    br.close()
