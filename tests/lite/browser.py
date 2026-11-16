"""Real Chromium interaction tests, using simulated WorkBuddy SDK and simulated localStorage; no real origin."""
from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];path=R/'dist/lite/OneDay-Lite-本机体验版.html'
checks=[]
def check(name,fn):
 try: fn();checks.append({'name':name,'pass':True});print('PASS',name)
 except Exception as e: checks.append({'name':name,'pass':False,'error':str(e)[:500]});print('FAIL',name,str(e)[:120])
def yes(value): assert value
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1440,'height':960},timezone_id='Asia/Shanghai');page=context.new_page();page.set_default_timeout(2500);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=path.read_text() if path.exists() else '<html><body>Lite build not implemented</body></html>'
 html=html.replace('<head>','<head><script>window.__testMemory={};Object.defineProperty(window,"localStorage",{value:{getItem:k=>window.__testMemory[k]||null,setItem:(k,v)=>window.__testMemory[k]=String(v),removeItem:k=>delete window.__testMemory[k]},configurable:true});</script>',1);page.set_content(html);page.wait_for_timeout(400)
 check('only task and note primary navigation',lambda:yes(page.locator('#desktopNav button').all_text_contents()==['任务','便签']))
 check('only calendar and board task views',lambda:yes(page.locator('#viewSwitch button').all_text_contents()==['日历','看板']))
 check('calendar grid and reachable unscheduled tasks',lambda:yes(page.locator('.month-grid').count()==1 and page.locator('[data-act="unscheduled-toggle"]').count()==1))
 check('no unhandled runtime errors',lambda:yes(not errors));b.close()
(R/'docs/lite/verification/browser-initial.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));sys.exit(0 if all(x['pass']for x in checks)else 1)
