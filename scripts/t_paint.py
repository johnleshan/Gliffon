import sys, io, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
PROD = os.environ.get('PROD', 'https://gliffon.vercel.app')
errs = []
stamp = str(int(time.time()))[-5:]
A, PW = 'aaa' + stamp, 'a good password 9'

def signup(page, user, pw, sym):
    page.goto(PROD, wait_until='networkidle'); page.wait_for_timeout(2500)
    page.locator('.claimwrap input').first.fill(user)
    page.locator('input[type=password]').fill(pw)
    page.locator('.symrow .sym', has_text=sym).click()
    page.locator('button[type=submit]').click()
    page.wait_for_timeout(3500)

def draw(page, bbox, strokes):
    # strokes are in canvas units (viewBox space); map them onto the real box
    sx = bbox['width'] / 640.0
    sy = bbox['height'] / 800.0
    for pts in strokes:
        page.mouse.move(bbox['x'] + pts[0][0] * sx, bbox['y'] + pts[0][1] * sy)
        page.mouse.down()
        for x, y in pts[1:]:
            page.mouse.move(bbox['x'] + x * sx, bbox['y'] + y * sy, steps=6)
            page.wait_for_timeout(30)
        page.mouse.up()
        page.wait_for_timeout(120)

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    a = br.new_context(viewport={'width': 420, 'height': 780}).new_page()
    a.on('pageerror', lambda e: errs.append(str(e)))
    signup(a, A, PW, '✦')
    print('signed up', A)

    # paint tab = 3rd bottombar button after reels, glyphs
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(800)

    # 1. orientation chooser appears
    portrait = a.locator('.orientcard', has_text='Portrait')
    print('1. orientation chooser:', portrait.count() == 1 and 'PASS' or 'FAIL')
    portrait.click(); a.wait_for_timeout(600)

    canvas = a.locator('.paintbox').bounding_box()
    print('2. canvas shown:', 'PASS' if canvas and canvas['height'] > canvas['width'] else 'FAIL')

    # 2. draw three strokes
    draw(a, canvas, [
        [(80, 100), (300, 140), (260, 360)],
        [(120, 500), (130, 700)],
        [(400, 200), (560, 220), (560, 640)]
    ])
    n = a.locator('.paintbox path').count()
    print('3. strokes drawn:', n, '->', 'PASS' if n == 3 else 'FAIL')

    # 3. draft persisted
    draft = a.evaluate("() => localStorage.getItem('gliffon.paint.draft')")
    draft_ok = draft and '"strokes":[{"pts"' in draft or (draft and '"pts"' in draft)
    print('4. draft saved:', 'PASS' if draft_ok else 'FAIL')

    # 4. undo removes a stroke; redo brings it back
    # (toolbar buttons are icon-only; click through the DOM via aria-label)
    click = lambda label: a.evaluate(f"""() => {{
      const b = [...document.querySelectorAll('.paintdock button')].find(x => (x.getAttribute('aria-label') || '').toLowerCase().includes('{label}'.toLowerCase()));
      b && b.click(); }}""")
    click('undo'); a.wait_for_timeout(300)
    n2 = a.locator('.paintbox path').count()
    click('redo'); a.wait_for_timeout(300)
    n3 = a.locator('.paintbox path').count()
    print(f'5. undo/redo: {n} -> {n2} -> {n3} ->', 'PASS' if n2 == 2 and n3 == 3 else 'FAIL')

    # 5. reload restores the draft (tabs reset to reels on reload, so go back)
    a.reload(wait_until='networkidle'); a.wait_for_timeout(3000)
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(1200)
    n4 = a.locator('.paintbox path').count()
    print('6. draft survives reload:', 'PASS' if n4 == 3 else 'FAIL')
    a.screenshot(path=f'{out}/sp-draft.png')

    # 6. cast it
    a.locator('.castform input.field').first.fill('my painted glyph')
    a.evaluate("() => [...document.querySelectorAll('.castform button')].find(b => b.textContent.includes('Cast painted'))?.click()")
    a.wait_for_timeout(4000)
    on_reels = a.locator('.reel').count() and a.locator('.reel .paintedglyph svg').count()
    print('7. cast lands in feed:', 'PASS' if on_reels else 'FAIL')
    a.screenshot(path=f'{out}/sp-cast.png')

    # 7. save to collection + shelf
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(600)
    draw(a, a.locator('.paintbox').bounding_box(), [
        [(100, 100), (600, 640)],
        [(600, 100), (100, 640)]
    ])
    a.evaluate("() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Save to collection'))?.click()")
    a.wait_for_timeout(2500)
    shelf = a.locator('.shelfitem').count()
    print('8. saved to collection:', 'PASS' if shelf == 1 else 'FAIL')

    # 8. cast from the shelf
    a.locator('.castform input.field').first.fill('x marks the spot')
    a.evaluate("() => document.querySelector('.shelfpick')?.click()"); a.wait_for_timeout(4000)
    cast_from_shelf = a.locator('.reel').count() >= 2
    print('9. cast from shelf:', 'PASS' if cast_from_shelf else 'FAIL')

    print('errors:', errs or 'none')
    print('USERS', A)
    br.close()
