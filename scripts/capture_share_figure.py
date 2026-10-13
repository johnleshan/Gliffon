import os, sys, urllib.request, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'technical-documentation', 'screenshots'))
TMP = r"C:\Users\JOHNLE~1\AppData\Local\Temp\opencode\docxbuild\img"
PROD = 'https://gliffon.vercel.app'

wall = json.loads(urllib.request.urlopen(PROD + '/api/wall').read().decode('utf-8'))
painted = next((g for g in wall if g.get('svg')), wall[0])
gid = painted['id']
print('capturing share page for', gid, '-', painted.get('label'))

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    ctx = br.new_context(viewport={'width': 1200, 'height': 820}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f'{PROD}/g/{gid}', wait_until='networkidle')
    page.wait_for_timeout(2500)
    page.screenshot(path=os.path.join(OUT, '14-public-share-page.png'))
    page.screenshot(path=os.path.join(TMP, '14-public-share-page.png'))
    br.close()
print('done')