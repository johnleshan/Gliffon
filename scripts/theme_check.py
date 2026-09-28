import os
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    page = browser.new_page(viewport={'width': 420, 'height': 780})
    page.on('pageerror', lambda e: console_errors.append(str(e)))
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)

    page.goto('http://localhost:5173', wait_until='networkidle')
    page.wait_for_timeout(1500)

    # Ember (default)
    page.screenshot(path=f'{out}/ember-boot.png')
    ember_bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    ember_text = page.evaluate("getComputedStyle(document.body).color")

    # Force Midnight to inspect CSS
    page.evaluate("document.documentElement.dataset.theme = 'midnight'")
    page.wait_for_timeout(500)
    mid_bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    mid_text = page.evaluate("getComputedStyle(document.body).color")
    accent = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
    accent2 = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim()")
    mint = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--mint').trim()")
    gold = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()")
    page.screenshot(path=f'{out}/midnight-boot.png')
    page.evaluate("document.documentElement.dataset.theme = ''")
    page.wait_for_timeout(300)

    print('ember  bg:', ember_bg, '| text:', ember_text)
    print('midnight bg:', mid_bg, '| text:', mid_text)
    print('midnight vars — love:', accent, '| memory:', accent2, '| creativity:', mint, '| mood:', gold)
    print('js/console errors:', console_errors[:5] or 'none')
    browser.close()
