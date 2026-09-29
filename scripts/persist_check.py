import sys, io, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')

    # device 1: claim an account
    ctx1 = browser.new_context(viewport={'width': 420, 'height': 780})
    p1 = ctx1.new_page()
    p1.goto('http://localhost:5173', wait_until='networkidle')
    p1.wait_for_timeout(1500)
    name = 'multi' + str(int(time.time()))[-4:]
    p1.locator('.claimwrap input').fill(name)
    p1.locator('button.btn.primary', has_text='Claim').click()
    p1.wait_for_timeout(3000)
    key = p1.evaluate("() => localStorage.getItem('gliffon.token')")
    print('device1 claimed @' + name, '| key length:', len(key or ''))

    # can the user even FIND that key? check settings
    p1.locator('.bbtab').nth(4).click()
    p1.wait_for_timeout(900)
    p1.locator('.settings summary').click()
    p1.wait_for_timeout(500)
    print('device1 sees Copy key button:', p1.locator('button', has_text='Copy key').count())
    p1.screenshot(path=f'{out}/settings-key.png')

    # device 2: brand new browser, zero storage
    ctx2 = browser.new_context(viewport={'width': 420, 'height': 780})
    p2 = ctx2.new_page()
    p2.goto('http://localhost:5173', wait_until='networkidle')
    p2.wait_for_timeout(1800)
    print('device2 shows auth screen:', p2.locator('.onboard').count())
    print('device2 storage:', p2.evaluate("() => localStorage.getItem('gliffon.token')"))
    p2.screenshot(path=f'{out}/device2-auth.png')

    # is there ANY visible way to recover?
    body = p2.locator('.onboard').inner_text()
    print('--- auth screen text ---')
    print(body)
    print('errors:', errors[:3] or 'none')
    print('KEY=' + (key or ''))
    browser.close()