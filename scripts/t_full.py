import sys, io, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
PROD = os.environ.get('PROD','https://gliffon.vercel.app')
errA, errB = [], []
stamp = str(int(time.time()))[-5:]
A, B = 'aaa' + stamp, 'bbb' + stamp
PA, PB = 'a good password 7', 'b good password 8'

def signup(ctx, user, pw, sym, errs):
    p = ctx.new_page()
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(PROD, wait_until='networkidle'); p.wait_for_timeout(2500)
    p.locator('.claimwrap input').first.fill(user)
    p.locator('input[type=password]').fill(pw)
    p.locator('.symrow .sym', has_text=sym).click()
    p.locator('button[type=submit]').click()
    p.wait_for_timeout(3500)
    return p

def cast(page, label, kind_name='Love'):
    page.locator('.bbtab').nth(1).click(); page.wait_for_timeout(800)
    kind = page.locator('.kinds .chip', has_text=kind_name)
    if kind.count(): kind.first.click(); page.wait_for_timeout(300)
    # label is an <input>, note is the <textarea>
    page.locator('.castform input.field').first.fill(label)
    page.wait_for_timeout(300)
    page.locator('.castform button', has_text='Cast glyph').click()
    page.wait_for_timeout(3000)

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    ca = br.new_context(viewport={'width':420,'height':780})
    cb = br.new_context(viewport={'width':420,'height':780})
    a = signup(ca, A, PA, '✦', errA)
    b = signup(cb, B, PB, '◆', errB)
    print('both signed up')

    # --- 1. SELF-LIKE ---
    cast(a, 'A own glyph')
    a.wait_for_timeout(1500)
    likes_before = a.locator('.act .count').first.inner_text()
    a.locator('.act').first.click()          # like own glyph
    a.wait_for_timeout(3000)
    likes_after = a.locator('.act .count').first.inner_text()
    print(f'1. SELF-LIKE: before={likes_before} after={likes_after} -> {"PASS" if likes_after == "1" else "FAIL"}')
    a.screenshot(path=f'{out}/f-selflike.png')

    # --- 2. B LIKES A's GLYPH -> A SEES IT LIVE (no reload) ---
    b.wait_for_timeout(3500)                 # let B's poll see A's cast
    b.screenshot(path=f'{out}/f-b-sees-cast.png')
    n_b = b.locator('.reel').count()
    print('2. B sees A cast without reload:', n_b, 'glyph(s) ->', 'PASS' if n_b >= 1 else 'FAIL')

    if b.locator('.reel').count():
        # B opens the LAST reel (A's) and likes it
        cnt_before = a.locator('.act .count').first.inner_text()
        b.locator('.reel').first.locator('.act').first.click()
        b.wait_for_timeout(4000)
        cnt_after = a.locator('.act .count').first.inner_text()
        print(f'3. LIVE LIKE A saw {cnt_before} -> {cnt_after} -> {"PASS" if cnt_before != cnt_after else "FAIL"}')

    # --- 4. COMMENT COUNTER updates without opening comments ---
    a.wait_for_timeout(2000)
    cc_before = a.locator('.reel').first.locator('.act').nth(1).locator('.count').inner_text()
    # B comments on A's glyph
    if b.locator('.reel').count():
        b.locator('.reel').first.locator('.act').nth(1).click()   # open comments (B)
        b.wait_for_timeout(900)
        b.locator('.comment-form input').fill('nice glyph!')
        b.locator('.comment-form button').click()
        b.wait_for_timeout(4000)
    a.wait_for_timeout(1000)
    cc_after = a.locator('.reel').first.locator('.act').nth(1).locator('.count').inner_text()
    print(f'4. COMMENT COUNT (A never opened): {cc_before} -> {cc_after} -> {"PASS" if cc_after != "0" else "FAIL"}')
    a.screenshot(path=f'{out}/f-commentcount.png')

    # --- 5. B SENDS DM -> A GETS UNREAD BADGE ---
    # A finds B and messages them
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(1200)
    a.locator('button.btn.primary', has_text='Find someone').click(); a.wait_for_timeout(700)
    a.locator('.sheet .field').fill(B)
    a.locator('.sheet button', has_text='Search').click(); a.wait_for_timeout(1800)
    a.locator('.sheet .contact button', has_text='Open chat').click()
    a.wait_for_timeout(1800)
    a.locator('.composer-row .field').fill('hi from A')
    a.locator('.composer-row .send').click()
    a.wait_for_timeout(4000)
    a.screenshot(path=f'{out}/f-chat-a.png')

    # B's side: unread badge
    b.locator('.bbtab').nth(2).click(); b.wait_for_timeout(3000)
    b.screenshot(path=f'{out}/f-chat-b-unread.png')
    pip = b.locator('.unread-pip').count()
    tabbadge = b.locator('.tab-badge').count()
    print('5. B unread: pip=', pip, ' tab-badge=', tabbadge, '->', 'PASS' if (pip or tabbadge) else 'FAIL')
    print('   B conv list text:', b.locator('.chats').inner_text()[:120].replace(chr(10), ' | '))

    # --- 6. conversation ORDER after a second thread ---
    b.locator('button.btn.primary', has_text='Find someone').click(); b.wait_for_timeout(700)
    b.locator('.sheet .field').fill(A)
    b.locator('.sheet button', has_text='Search').click(); b.wait_for_timeout(1800)
    b.locator('.sheet .contact button', has_text='Open chat').click()
    b.wait_for_timeout(1500)
    b.locator('.composer-row .field').fill('reply from B')
    b.locator('.composer-row .send').click()
    b.wait_for_timeout(4000)
    b.locator('.bbtab').nth(2).click(); b.wait_for_timeout(1500)
    b.screenshot(path=f'{out}/f-chat-b-order.png')
    names = b.locator('.contact-top b').all_inner_texts()
    print('6. B conversation order (newest first):', names)
    print('   errors A:', errA[:3] or 'none', '| B:', errB[:3] or 'none')
    print('USERS', A, B)
    br.close()
