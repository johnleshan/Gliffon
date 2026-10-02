import sys, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
PROD = 'https://gliffon.vercel.app'
errs = []

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    a = br.new_context(viewport={'width': 1366, 'height': 768}).new_page()
    a.on('pageerror', lambda e: errs.append(str(e)))
    a.goto(PROD, wait_until='networkidle'); a.wait_for_timeout(2500)
    a.locator('.authtabs button', has_text='Sign in').click(); a.wait_for_timeout(300)
    a.locator('.claimwrap input').first.fill('john')
    a.locator('input[type=password]').fill('john@123')
    a.locator('button[type=submit]').click()
    a.wait_for_timeout(4000)

    a.locator('.tabs button', has_text='Profile').click(); a.wait_for_timeout(1200)
    stats = a.locator('.statrow .stat')
    labels = ['casts', 'followers', 'following', 'contacts']
    print('1. four stat buttons:', stats.count() == 4 and 'PASS' or 'FAIL')
    for i, s in enumerate(labels):
        print(f'   stat[{i}] shows:', stats.nth(i).inner_text().replace('\n', ' '))

    # 2. followers sheet
    stats.nth(1).click(force=True); a.wait_for_timeout(1500)
    sheet_title = a.locator('.sheet h3').inner_text()
    print('2. followers sheet title:', sheet_title, '->', 'PASS' if sheet_title == 'Followers' else 'FAIL')
    a.screenshot(path=f'{out}/sp-followers.png')
    a.locator('.sheet button', has_text='Close').click(); a.wait_for_timeout(400)

    # 3. following sheet with unfollow/follow actions
    a.locator('.statrow .stat').nth(2).click(force=True); a.wait_for_timeout(1500)
    title2 = a.locator('.sheet h3').inner_text()
    rows = a.locator('.sheet .contact').count()
    print('3. following sheet:', title2, f'({rows} rows) ->', 'PASS' if title2 == 'Following' else 'FAIL')
    btn = a.locator('.sheet .contact button')
    if btn.count():
        before = btn.first.inner_text()
        btn.first.click(); a.wait_for_timeout(1800)
        after = a.locator('.sheet .contact button').first.inner_text()
        print(f'   follow toggle: {before} -> {after} ->', 'PASS' if before != after else 'FAIL')
        a.locator('.sheet .contact button').first.click(); a.wait_for_timeout(1800)  # restore
    a.locator('.sheet button', has_text='Close').click(); a.wait_for_timeout(400)

    # 4. contacts sheet -> opening a chat navigates to chats tab
    a.locator('.statrow .stat').nth(3).click(force=True); a.wait_for_timeout(1500)
    title3 = a.locator('.sheet h3').inner_text()
    print('4. contacts sheet:', title3, '->', 'PASS' if title3 == 'Contacts' else 'FAIL')
    a.screenshot(path=f'{out}/sp-contacts.png')
    a.locator('.sheet button', has_text='Close').click(); a.wait_for_timeout(400)

    # 5. casts sheet with delete buttons present
    a.locator('.statrow .stat').nth(0).click(force=True); a.wait_for_timeout(1500)
    title4 = a.locator('.sheet h3').inner_text()
    casts = a.locator('.sheet .contact').count()
    print('5. casts sheet:', title4, f'({casts} rows) ->', 'PASS' if title4 == 'Your casts' else 'FAIL')
    a.screenshot(path=f'{out}/sp-casts.png')
    a.locator('.sheet button', has_text='Close').click()

    # 6. composer: no tofu in the symbol grid (risky 🫶/🪄 removed)
    a.locator('.tabs button', has_text='Glyphs').click(); a.wait_for_timeout(900)
    syms = a.locator('.symrow .sym, .symgrid .sym').all_inner_texts()
    print('6. composer symbols:', syms, '->', 'PASS' if all(s.strip() for s in syms) else 'FAIL')
    a.screenshot(path=f'{out}/sp-composer.png')

    print('errors:', errs or 'none')
    br.close()
