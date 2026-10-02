import sys, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
PROD = 'https://gliffon.vercel.app'
errs = []

SVGMARK = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 640"><g fill="none" '
           'stroke-linecap="round" stroke-linejoin="round">'
           '<path d="M120 80L680 560" stroke="#ffc46b" stroke-width="14"/>'
           '<path d="M680 80L120 560" stroke="#8b7bff" stroke-width="14"/>'
           '<path d="M400 40C300 140 300 500 400 600" stroke="#00e5ff" stroke-width="8"/>'
           '</g></svg>')

import urllib.request, json as J

def api(path, body=None, token=None):
    req = urllib.request.Request(PROD + path, method='POST' if body else 'GET',
        data=J.dumps(body).encode() if body else None,
        headers={'content-type': 'application/json', **({'x-auth-token': token} if token else {})})
    return J.loads(urllib.request.urlopen(req).read())

r = api('/api/auth?action=login', {'username': 'john', 'password': 'john@123', 'label': 'glyph-painter dev check'})
tok = r['token']
api('/api/wall', {'id': 'paintdemo' + str(int(time.time()))[-5:], 'kind': 'painted', 'symbol': '✦',
                  'label': 'First painted glyph', 'note': 'drawn on the paint screen', 'svg': SVGMARK}, tok)
print('painted demo cast ok')

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    a = br.new_context(viewport={'width': 1366, 'height': 768}).new_page()
    a.on('pageerror', lambda e: errs.append(str(e)))
    a.goto(PROD, wait_until='networkidle'); a.wait_for_timeout(2500)
    # sign in
    a.locator('.authtabs button', has_text='Sign in').click(); a.wait_for_timeout(300)
    a.locator('.claimwrap input').first.fill('john')
    a.locator('input[type=password]').fill('john@123')
    a.locator('button[type=submit]').click()
    a.wait_for_timeout(4000)
    # find the painted reel and screenshot it full-bleed
    a.wait_for_timeout(2500)
    painted = a.locator('.reel').filter(has=a.locator('.paintedglyph'))
    print('desktop painted reels visible:', painted.count())
    a.screenshot(path=f'{out}/sp-desktop-feed.png')
    # paint tab on desktop
    a.locator('.tabs button', has_text='Paint').click(); a.wait_for_timeout(900)
    orient = a.locator('.orientcard', has_text='Landscape')
    if orient.count(): orient.click(); a.wait_for_timeout(600)
    box = a.locator('.paintbox').bounding_box()
    print('desktop paintbox:', 'PASS' if box and box['width'] > 480 else f"FAIL {box}")
    a.screenshot(path=f'{out}/sp-desktop-paint.png')
    print('errors:', errs or 'none')
    br.close()
