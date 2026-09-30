import sys, io, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
PROD = os.environ.get('PROD', 'http://localhost:5173')
stamp = str(int(time.time()))[-5:]
A, B, C = 'aaa' + stamp, 'bbb' + stamp, 'ccc' + stamp
PW = 'a good password 7'
errs = []

def signup(ctx, user, sym):
    p = ctx.new_page()
    p.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    p.goto(PROD, wait_until='networkidle'); p.wait_for_timeout(2500)
    p.locator('.claimwrap input').first.fill(user)
    p.locator('input[type=password]').fill(PW)
    p.locator('.symrow .sym', has_text=sym).click()
    p.locator('button[type=submit]').click()
    p.wait_for_timeout(3500)
    return p

def open_thread(page, peer):
    page.locator('.bbtab').nth(2).click(); page.wait_for_timeout(1500)
    if page.locator('.chathead').count():
        page.locator('.chathead button').click(); page.wait_for_timeout(1000)
    page.locator('button.btn.primary', has_text='Find someone').click(); page.wait_for_timeout(800)
    page.locator('.sheet .field').fill(peer); page.wait_for_timeout(300)
    page.locator('.sheet button', has_text='Search').click(); page.wait_for_timeout(2200)
    page.locator('.sheet .contact button', has_text='Open chat').click()
    page.wait_for_timeout(1800)

def say(page, text):
    page.locator('.composer-row input').fill(text)
    page.locator('.composer-row .send').click()
    page.wait_for_timeout(2500)

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    a = signup(br.new_context(viewport={'width':420,'height':780}), A, '✦')
    b = signup(br.new_context(viewport={'width':420,'height':780}), B, '◆')
    c = signup(br.new_context(viewport={'width':420,'height':780}), C, '★')
    print('1. thread opens from search:', end=' ')
    open_thread(a, B)
    print('PASS' if a.locator('.chathead').count() else 'FAIL')
    say(a, 'A to B')

    open_thread(a, C); say(a, 'A to C')
    a.locator('.chathead button').click(); a.wait_for_timeout(2500)
    a.screenshot(path=f'{out}/h-order.png')
    order = a.locator('.contact-top b').all_inner_texts()
    print('2. order (newest first):', order, '->', 'PASS' if len(order) == 2 else 'FAIL')
    print('   previews:', [x[:24] for x in a.locator('.contact .msgpreview').all_inner_texts()])

    open_thread(b, A); say(b, 'B reply to A')
    b.locator('.chathead button').click(); b.wait_for_timeout(2000)
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(3500)
    a.screenshot(path=f'{out}/h-unread.png')
    pips = a.locator('.unread-pip').count()
    print('3. unread pip=', pips, 'tab badge=', a.locator('.tab-badge').count(), '->', 'PASS' if pips == 1 else 'FAIL')

    rows = a.locator('.contact')
    for i in range(rows.count()):
        if B in rows.nth(i).inner_text():
            rows.nth(i).click(); break
    a.wait_for_timeout(2500)
    a.locator('.chathead button').click(); a.wait_for_timeout(3000)
    after = a.locator('.unread-pip').count()
    print('4. after opening thread, pip=', after, '->', 'PASS' if after == 0 else 'FAIL')

    a.reload(wait_until='networkidle'); a.wait_for_timeout(4000)
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(2500)
    ghost = a.locator('.unread-pip').count()
    print('5. after reload, pip=', ghost, '->', 'PASS' if ghost == 0 else 'FAIL (ghost unread)')
    a.screenshot(path=f'{out}/h-afterread.png')
    print('errors:', errs[:3] or 'none')
    print('USERS', A, B, C)
    br.close()
