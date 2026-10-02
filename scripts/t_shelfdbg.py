import sys, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

PROD = 'https://gliffon.vercel.app'
stamp = str(int(time.time()))[-5:]
A, PW = 'bbb' + stamp, 'b good password 9'

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    a = br.new_context(viewport={'width': 420, 'height': 780}).new_page()
    console = []
    a.on('console', lambda m: console.append(m.type + ': ' + m.text))
    a.goto(PROD, wait_until='networkidle'); a.wait_for_timeout(2500)
    a.locator('.claimwrap input').first.fill(A)
    a.locator('input[type=password]').fill(PW)
    a.locator('button[type=submit]').click()
    a.wait_for_timeout(3500)
    a.locator('.bbtab').nth(2).click(); a.wait_for_timeout(700)
    a.locator('.orientcard', has_text='Portrait').click(); a.wait_for_timeout(500)

    bbox = a.locator('.paintbox').bounding_box()
    sx, sy = bbox['width'] / 640, bbox['height'] / 800
    a.mouse.move(bbox['x'] + 100 * sx, bbox['y'] + 100 * sy)
    a.mouse.down()
    a.mouse.move(bbox['x'] + 500 * sx, bbox['y'] + 600 * sy, steps=8)
    a.mouse.up(); a.wait_for_timeout(200)

    a.evaluate("() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Save to collection'))?.click()")
    a.wait_for_timeout(3000)
    shelf = a.locator('.shelfitem').count()
    toast = a.locator('.toast').inner_text() if a.locator('.toast').count() else '(none)'
    print('shelf items:', shelf, '| toast:', toast)
    print('console:', console[-8:] if console else 'none')
    br.close()
