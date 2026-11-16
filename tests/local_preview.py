from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];source=(R/'OneDay-v10-本机体验版.html').read_text();production=(R/'todo-app/index.html').read_text();checks=[]
def expect(v):assert v
shim='''<head><script>var __mem=SEEDSTORE;var __deny=false;Object.defineProperty(window,'localStorage',{value:{getItem:k=>__mem[k]||null,setItem:(k,v)=>{if(__deny)throw new Error('quota test');__mem[k]=String(v)},removeItem:k=>delete __mem[k]},configurable:true});window.confirm=()=>true;</script>'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(3000);errors=[]
 def load(store=None,src=source):
  global page
  page.close();page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(3000);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(src.replace('<head>',shim.replace('SEEDSTORE',json.dumps(store or {})),1));page.wait_for_timeout(200)
 def check(name,fn):
  try:load();fn();checks.append({'name':name,'passed':True});print('PASS',name)
  except Exception as e:checks.append({'name':name,'passed':False,'error':str(e)[:400]});print('FAIL',name,str(e)[:120])
 def save_restore():
  page.locator('#odCapture').fill('跨文档保存的本机任务');page.locator('#odCaptureSubmit').click();page.wait_for_timeout(400);data=page.evaluate('__mem');expect('跨文档保存的本机任务' in data['oneday.v10.local-demo.data']);load(data);page.locator('#mainNav [data-tab="task"]').click();page.locator('#odListSearch').fill('跨文档保存');expect('跨文档保存的本机任务' in page.locator('#odListResults').inner_text())
 check('local adapter writes storage then restores in a new test document',save_restore)
 def failure():
  page.evaluate('__deny=true');page.locator('#odCapture').fill('拒绝存储不能成功');page.locator('#odCaptureSubmit').click();page.wait_for_timeout(250);expect(page.locator('#odCapture').input_value()=='拒绝存储不能成功');expect('保存失败' in page.locator('#odNotice').inner_text());expect('oneday.v10.local-demo.data' not in page.evaluate('__mem'))
 check('local quota denial rejects write and retains capture text',failure)
 def no_cloud():
  load(src=production);expect('未检测到资料库数据环境' in page.locator('#viewHost').inner_text());expect(not page.evaluate('!!window.__ONEDAY_LOCAL__'));expect('尚未连接' in page.locator('#odSync').get_attribute('title'))
 check('production never silently falls back to local demo without SDK',no_cloud)
 def csv_import():
  page.locator('#odSync').click()
  with page.expect_file_chooser() as fc:page.locator('[data-od="import-csv"]').click()
  fc.value.set_files({'name':'sample.csv','mimeType':'text/csv','buffer':'任务标题,优先级,任务详情\n追加验证,高,"第一行\n第二行"\n追加验证,高,"第一行\n第二行"'.encode()})
  page.locator('#odImportConfirm').click();page.wait_for_timeout(500);expect('新增 1 项，跳过 1 项' in page.locator('#odImportStatus').inner_text());d=json.loads(page.evaluate("__mem['oneday.v10.local-demo.data']"));r=[r for r in d['tables']['oneday-tasks']if r['任务标题']=='追加验证'];expect(len(r)==1 and r[0]['任务详情']=='第一行\n第二行')
 check('CSV preview appends once, skips duplicate and preserves multiline text',csv_import)
 def csv_invalid():
  page.locator('#odSync').click()
  with page.expect_file_chooser() as fc:page.locator('[data-od="import-csv"]').click()
  fc.value.set_files({'name':'invalid.csv','mimeType':'text/csv','buffer':'任务标题,计划开始时间\n坏日期,2026-02-31'.encode()});page.wait_for_timeout(100);expect('没有写入任何数据' in page.locator('#modalRoot').inner_text());expect('oneday.v10.local-demo.data' not in page.evaluate('__mem'))
 check('invalid CSV stops before any writes',csv_invalid)
 def flags():
  expect('非云同步' in page.locator('#odSync').inner_text());expect('示例内容' in page.locator('#odNotice').inner_text())
 check('demo is visibly labeled non-cloud and synthetic',flags)
 def responsive():
  for width in [360,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});expect(page.evaluate('document.documentElement.scrollWidth<=innerWidth'));expect(page.locator('#odCapture').is_visible())
 check('no document overflow at 360/390/768/1440 widths',responsive)
 def dialog():
  page.set_viewport_size({'width':390,'height':844});page.locator('#odSync').click();expect(page.locator('[role="dialog"]').last.is_visible());page.locator('#modalRoot>.mask').last.locator('[data-close]').first.click();expect(page.locator('#odDataCenter').count()==0)
 check('data dialog opens and closes on phone viewport',dialog)
 checks.append({'name':'no unhandled runtime errors','passed':not errors,'errors':errors});print('RUNTIME',errors);b.close()
(R/'docs/verification/local-preview.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));sys.exit(0 if all(c['passed']for c in checks)else 1)
