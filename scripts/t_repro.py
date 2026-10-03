import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

out = os.path.join(os.environ['TEMP'], 'opencode')
err_original = []

with sync_playwright() as p:
    br = p.chromium.launch(headless=True, channel='chrome')
    a = br.new_context(viewport={'width': 359, 'height': 800}).new_page()
    a.on('pageerror', lambda e: out_original.append(str(e)))
    errors = []
    a.on('pageerror', lambda e: errors.append(str(e)))
    a.goto('https://gliffon.vercel.app', wait_until='networkidle'); a.wait_for_timeout(2200)
    a.locator('.authtabs button', has_text='Sign in').click(); a.wait_for_timeout(300)
    a.locator('.claimwrap input').first.fill('john')
    a.locator('input[type=password]').fill('john@123')
    a.locator('button[type=submit]').click(); a.wait_for_timeout(3500)
    a.locator('.tabs button', has_text='Chats').first.click(); a.wait_for_timeout(1200)
    print('mounted sections:', a.evaluate("() => [...document.querySelectorAll('main, section, .reels, .chats, .pulse, .composer, .paint')].map(e => e.className).join(' | ')"))
    print('scrollWidth-clientWidth:', a.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"))
    a.screenshot(path=f'{out}/rep-359-chats.png')
    a.locator('.tabs button', has_text='Pulse').first.click(); a.wait_for_timeout(1500)
    print('pulse sections:', a.evaluate("() => [...document.querySelectorAll('main, section')].map(e => e.className).slice(0, 12).join(' | ')"))
    print('errors:', errors or 'none')
    br.close()
