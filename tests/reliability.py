"""Behavior tests in real Chromium with an injected WorkBuddy contract fixture.
set_content uses a test document, not a production origin or live SDK.
"""
from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
h=(R/'todo-app/index.html').read_text()
data=json.loads((R/'todo-app/dev/mock-data.json').read_text())
T='oneday-tasks'
id=data[T][0]['record_id'];data[T][0]['计划开始时间']='2026-09-21T09:30:00Z';data[T][0]['计划截止时间']='2026-09-21T10:15:00Z'
fixture='''<script>
var __DATA=DATAJSON,__calls=[],__failQ=false,__failW=false;
Object.defineProperty(window,'localStorage',{value:(()=>{const m={};return {getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}})(),configurable:true});
window.__SMART_PAGE__={database:{
query:p=>__failQ?Promise.reject(Error('simulated-read-failure')):Promise.resolve({results:structuredClone(__DATA[p.databaseId]||[]),hasMore:false}),
addRecord:p=>{if(__failW)return Promise.reject(Error('simulated-write-failure'));const id='new_'+Date.now();let r={_id:id};for(const [k,v]of Object.entries(p.properties))r[k]=Object.values(v)[0];__DATA[p.databaseId].push(r);__calls.push(p);return Promise.resolve({id})},
updateRecord:p=>{if(__failW)return Promise.reject(Error('simulated-write-failure'));let r=__DATA[p.databaseId].find(r=>(r._id||r.record_id)===p.recordId);for(const[k,v]of Object.entries(p.properties))r[k]=Object.values(v)[0];__calls.push(p);return Promise.resolve({id:p.recordId})},
deleteRecord:p=>{__calls.push(p);return Promise.resolve({})},onUpdated:()=>{}}};</script>'''.replace('DATAJSON',json.dumps(data,ensure_ascii=False))
h=h.replace('<script>\n(function () {\n  \'use strict\';',fixture+"<script>\n(function () {\n  'use strict';",1)
h=h.replace("  if (document.readyState === 'loading')", "  window.__test={S:S,reload:reload,detail:openTaskDetail,md:mdToHtml,rid:rid};\n  if (document.readyState === 'loading')")
out=[]
def check(name,ok):out.append({'name':name,'passed':bool(ok)});print(('PASS 'if ok else'FAIL ')+name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_content(h);page.wait_for_timeout(300)
 check('addRecord response id is recognized',page.evaluate("__test.rid({id:'x'})==='x'"))
 check('Markdown javascript link is rejected',not page.evaluate("__test.md('[go](javascript:alert%281%29)').includes('href=\"javascript:')"))
 page.evaluate('(id)=>__test.detail(id)',id);page.locator('#tdTitle').fill('Changed title');page.locator('#tdTitle').dispatch_event('change');page.wait_for_timeout(1400)
 r=page.evaluate('(id)=>__DATA["'+T+'"].find(t=>t.record_id===id)',id)
 check('title edit preserves precise planned start',r['计划开始时间']=='2026-09-21T09:30:00Z')
 check('title edit preserves precise planned end',r['计划截止时间']=='2026-09-21T10:15:00Z')
 check('detail save uses a field-only patch',page.evaluate('__calls.filter(x=>x.properties)[0]&&Object.keys(__calls.filter(x=>x.properties)[0].properties).length===1'))
 old=page.evaluate('__test.S.tasks.length');page.evaluate('__failQ=true;__test.reload()');page.wait_for_timeout(500)
 check('failed read retains last good snapshot',page.evaluate('__test.S.tasks.length')==old)
 check('read failure visible to user',page.locator('body').inner_text().find('读取失败')>=0)
 b.close()
(R/'docs/verification'/('reliability-'+('green' if all(i['passed']for i in out)else'red')+'.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2))
sys.exit(0 if all(i['passed']for i in out)else 1)
