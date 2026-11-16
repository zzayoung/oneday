"""Capture the standalone sample in Chromium; no hosted/cloud environment is involved."""
from pathlib import Path
from playwright.sync_api import sync_playwright
R = Path(__file__).resolve().parents[1]
html = (R / 'OneDay-v10-本机体验版.html').read_text()
shim = '''<head><script>const _store={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>_store[k]??null,setItem:(k,v)=>_store[k]=String(v),removeItem:k=>delete _store[k],key:i=>Object.keys(_store)[i]??null,get length(){return Object.keys(_store).length;}},configurable:true});</script>'''
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':1024}, device_scale_factor=1)
    errors = []
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html.replace('<head>',shim,1));page.wait_for_timeout(350)
    page.screenshot(path=str(R/'docs/verification/v10-desktop.png'))
    page.locator('#mainNav [data-tab="review"]').click();page.wait_for_timeout(100)
    page.screenshot(path=str(R/'docs/verification/v10-review.png'))
    page.locator('#mainNav [data-tab="task"]').click();page.wait_for_timeout(100)
    page.screenshot(path=str(R/'docs/verification/v10-tasks.png'))
    page.locator('#mainNav [data-tab="today"]').click()
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
    page.screenshot(path=str(R/'docs/verification/v10-mobile-home.png'))
    page.locator('#odBottomNav [data-tab="task"]').click();page.wait_for_timeout(100)
    page.screenshot(path=str(R/'docs/verification/v10-mobile-tasks.png'))
    print('Captured demo screenshots. Runtime errors:',errors)
    browser.close()
