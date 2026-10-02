import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
PROD = 'https://gliffon.vercel.app'

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    a = br.new_context(viewport={'width': 390, 'height': 780}).new_page()
    a.goto(PROD, wait_until='networkidle'); a.wait_for_timeout(2500)
    a.locator('.authtabs button', has_text='Sign in').click(); a.wait_for_timeout(300)
    a.locator('.claimwrap input').first.fill('john')
    a.locator('input[type=password]').fill('john@123')
    a.locator('button[type=submit]').click(); a.wait_for_timeout(4000)
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(700)
    o = a.locator('.orientcard', has_text='Portrait')
    if o.count(): o.click(); a.wait_for_timeout(600)
    a.screenshot(path=f'{out}/sp-mobile-paint.png')
    br.close()
