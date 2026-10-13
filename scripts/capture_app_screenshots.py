import sys, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'technical-documentation', 'screenshots')
SHOTS = os.path.abspath(SHOTS)
PROD = 'https://gliffon.vercel.app'
errs = []


def shot(page, name, full=False):
    page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(SHOTS, name), full_page=full)
    print('captured', name)


def draw(page, bbox, strokes, sx=None, sy=None):
    sx = sx or (bbox['width'] / 640.0)
    sy = sy or (bbox['height'] / 800.0)
    for pts in strokes:
        page.mouse.move(bbox['x'] + pts[0][0] * sx, bbox['y'] + pts[0][1] * sy)
        page.mouse.down()
        for x, y in pts[1:]:
            page.mouse.move(bbox['x'] + x * sx, bbox['y'] + y * sy, steps=8)
            page.wait_for_timeout(25)
        page.mouse.up()
        page.wait_for_timeout(120)


with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')

    # ---------- desktop / tablet context for wide captures ----------
    d = br.new_context(viewport={'width': 1366, 'height': 900}, device_scale_factor=2)
    dp = d.new_page()
    dp.goto(PROD, wait_until='networkidle'); dp.wait_for_timeout(2500)
    dp.locator('.authtabs button', has_text='Sign in').click(); dp.wait_for_timeout(400)
    dp.locator('.claimwrap input').first.fill('john')
    dp.locator('input[type=password]').fill('john@123')
    dp.locator('button[type=submit]').click(); dp.wait_for_timeout(4000)
    shot(dp, '13-desktop-feed.png')

    # public share page for the painted glyph
    wid = dp.evaluate("""async () => {
      const r = await fetch('https://gliffon.vercel.app/api/wall').then(x => x.json());
      const painted = r.find(g => g.svg);
      return (painted || r[0]).id;
    }""")
    dp.goto(f'{PROD}/g/{wid}', wait_until='networkidle'); dp.wait_for_timeout(2500)
    shot(dp, '12-public-share-page.png')
    d.close()

    # ---------- mobile context (the design target) ----------
    m = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    a = m.new_page()
    a.on('pageerror', lambda e: errs.append(str(e)))
    a.goto(PROD, wait_until='networkidle'); a.wait_for_timeout(2500)

    shot(a, '01-auth-sign-in.png')
    a.locator('.authtabs button', has_text='Create account').click(); a.wait_for_timeout(600)
    shot(a, '02-auth-create-account.png')
    a.locator('.authtabs button', has_text='Sign in').click(); a.wait_for_timeout(400)
    a.locator('.claimwrap input').first.fill('john')
    a.locator('input[type=password]').fill('john@123')
    a.locator('button[type=submit]').click(); a.wait_for_timeout(4200)

    shot(a, '03-feed-reels.png')

    # painted glyph reel
    idx = a.evaluate("() => { const r = [...document.querySelectorAll('.reel')]; return r.findIndex(x => x.querySelector('.paintedglyph')); }")
    if idx >= 0:
        a.evaluate(f"""() => {{ const r = [...document.querySelectorAll('.reel')][{idx}]; r.scrollIntoView(); }}""")
        a.wait_for_timeout(1400)
        shot(a, '04-feed-painted-glyph.png')

    a.locator('.tabs button', has_text='Glyphs').first.click(); a.wait_for_timeout(900)
    shot(a, '05-composer-cast-a-glyph.png')

    a.locator('.tabs button', has_text='Paint').first.click(); a.wait_for_timeout(800)
    o = a.locator('.orientcard', has_text='Portrait')
    if o.count():
        shot(a, '06-paint-choose-canvas.png')
        o.click(); a.wait_for_timeout(700)

    box = a.locator('.paintbox').bounding_box()
    if box:
        draw(a, box, [
            [(150, 220), (300, 180), (420, 300), (380, 460), (250, 520), (170, 430)],
            [(470, 200), (520, 420), (470, 620)],
            [(140, 300), (560, 560)]
        ], box['width'] / 640.0, box['height'] / 800.0)
        a.wait_for_timeout(500)
        shot(a, '07-paint-studio.png')

        # eraser ring visual
        a.evaluate("() => document.querySelector('[aria-label=eraser]')?.click()")
        a.wait_for_timeout(300)
        a.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.45)
        a.wait_for_timeout(500)
        shot(a, '08-paint-eraser-ring.png')

    a.locator('.tabs button', has_text='Chats').first.click(); a.wait_for_timeout(1000)
    shot(a, '09-chats-conversations.png')

    a.locator('.tabs button', has_text='Pulse').first.click(); a.wait_for_timeout(1200)
    shot(a, '10-pulse-activity.png')

    a.locator('.tabs button', has_text='Profile').first.click(); a.wait_for_timeout(1200)
    shot(a, '11-profile.png')

    st = a.locator('.statrow .stat')
    if st.count() >= 2:
        st.nth(1).evaluate('el => el.click()')
        a.wait_for_timeout(1400)
        shot(a, '12-profile-followers-sheet.png')

    print('errors:', errs or 'none')
    br.close()
print('done ->', SHOTS)