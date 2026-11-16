from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
root = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
app=root/'todo-app'
source=(app/'index.html').read_text()
test=(app/'dev/_test.js').read_text()
test='const w=window,d=document,errs=window.__errors,logs=window.__logs;\n'+test[test.index('const sleep ='):]
test=test.replace("const htmlText = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');",'const htmlText=window.__source;')
test=test.replace("await sleep(500);","await sleep(500);click(q('#mainNav [data-tab=task]'));click(q('#taskViewSeg [data-view=month]'));await sleep(200);",1)
test=test.replace("tabs.join('/') === '任务/便签'","tabs.join('/') === '今日/任务/便签/回顾'").replace("views.join('/') === '日历/看板'","views.join('/') === '收集箱/全部/日历/看板'")
test=test.replace('process.exit(bad.length ? 1 : 0);','window.__test_result={passed:ok,failed:bad,errors:errs};')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':960})
 page.evaluate('window.__logs=[];window.__errors=[];'+
 "for(const k of ['log','warn','error']){const f=console[k].bind(console);console[k]=(...a)=>{(k==='log'?window.__logs:window.__errors).push(a.join(' '));f(...a)}};window.onerror=(m)=>window.__errors.push(String(m));window.confirm=()=>true;window.prompt=(m,d)=>d;")
 mock=(app/'dev/_mock.html').read_text().replace('<head>', '<head><script>Object.defineProperty(window,"localStorage",{value:(()=>{const m={};return {getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}})(),configurable:true});</script>',1)
 page.set_content(mock, wait_until='domcontentloaded');page.wait_for_timeout(700)
 page.screenshot(path=str(root/'docs/verification/v10-legacy-desktop.png'))
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'docs/verification/v10-legacy-mobile.png'));page.set_viewport_size({'width':1440,'height':960})
 page.evaluate('(x)=>window.__source=x',source)
 page.evaluate(test)
 page.wait_for_function('window.__test_result',timeout=45000)
 result=page.evaluate('window.__test_result')
 out=(root/'docs/verification/v10-legacy.json');out.write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print('PASSED',len(result['passed']),'FAILED',len(result['failed']),'ERRORS',len(result['errors']))
 print('\n'.join(result['failed']));print('\n'.join(result['errors']))
 browser.close()

sys.exit(1 if result["failed"] or result["errors"] else 0)
