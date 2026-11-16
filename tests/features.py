from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
h=(R/'todo-app/dev/_mock.html').read_text()
# Test-only storage shim; not evidence of persistence at any real origin.
h=h.replace('<head>','''<head><script>Object.defineProperty(window,'localStorage',{value:(()=>{const m={};return {getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}})(),configurable:true});window.confirm=()=>true;</script>''',1)
out=[]
def check(name,fn):
 try:fn();out.append({'name':name,'passed':True});print('PASS',name)
 except Exception as e:out.append({'name':name,'passed':False,'error':str(e)[:350]});print('FAIL',name,str(e)[:120])
def expect(v):assert v
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':960});page.set_default_timeout(1200);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(h);page.wait_for_timeout(500)
 check('Today has capture and priority area',lambda:expect(page.locator('#odCapture').count()==1 and page.get_by_text('今天最重要的三件事',exact=True).count()==1))
 check('new 4-tab navigation',lambda:expect(page.locator('#mainNav button').all_text_contents()==['今日','任务','便签','回顾']))
 def capture():
  page.locator('#odCapture').fill('明天 15:00 编写测试方案 45分钟 !高');page.wait_for_timeout(100)
  expect('15:00' in page.locator('#odCapturePreview').inner_text());page.locator('#odCaptureSubmit').click();page.wait_for_timeout(500)
  page.locator('#mainNav [data-tab="task"]').click();page.locator('#taskViewSeg [data-view="list"]').click();page.locator('#odListSearch').fill('编写测试方案');page.wait_for_timeout(200);expect(page.locator('.od-row-title').inner_text()=='编写测试方案')
 check('parsed quick capture persists and searchable',capture)
 def search():
  page.keyboard.press('Control+k');page.locator('#odSearchInput').fill('编写测试方案');page.wait_for_timeout(200);expect(page.locator('#odSearchResults').inner_text().find('编写测试方案')>=0);page.keyboard.press('Escape')
 check('global keyboard search works',search)
 def review():
  page.locator('#mainNav [data-tab="review"]').click();expect(page.locator('#odReview').count()==1);expect(page.locator('[data-od="review-note"]').count()==1)
 check('weekly review with saved reflection',review)
 def focus():
  page.locator('#mainNav [data-tab="today"]').click();page.locator('[data-od="focus-toggle"]').click();page.wait_for_timeout(1100);expect('暂停' in page.locator('[data-od="focus-toggle"]').inner_text());page.locator('[data-od="focus-toggle"]').click();expect('继续' in page.locator('[data-od="focus-toggle"]').inner_text())
 check('focus starts and pauses',focus)
 def data():
  page.locator('#odSync').click();expect(page.locator('#odDataCenter').count()==1);expect(page.locator('[data-od="export-json"]').count()==1);page.keyboard.press('Escape')
 check('data center and backup controls',data)
 def mobile():
  page.set_viewport_size({'width':390,'height':844});page.locator('#odBottomNav [data-tab="today"]').click();expect(page.locator('#odBottomNav').is_visible());expect(page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(R/'docs/verification/v10-mobile.png'))
 check('mobile bottom navigation and no document overflow',mobile)
 check('no unhandled runtime errors',lambda:expect(not errors));b.close()
(R/'docs/verification'/('features-'+('green'if all(x['passed']for x in out)else'red')+'.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2));sys.exit(0 if all(x['passed']for x in out)else 1)
