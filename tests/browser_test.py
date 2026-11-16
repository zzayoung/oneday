"""Failure injection & integrity suite. Does not contact WorkBuddy."""
from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];h=(R/'todo-app/index.html').read_text();D=json.loads((R/'todo-app/dev/demo-data-v10.json').read_text());T='oneday-tasks';N='oneday-notes'
fixture='''<script>
var __DATA=SEED,__attempts=[],__failure='',__delay=0,__liveWrites=0,__maxWrites=0;
var __store={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__store[k]||null,setItem:(k,v)=>__store[k]=String(v),removeItem:k=>delete __store[k]},configurable:true});
window.confirm=()=>true;window.prompt=(m,d)=>d;
function __write(op,p){__attempts.push({op,...p});__liveWrites++;__maxWrites=Math.max(__maxWrites,__liveWrites);return new Promise((resolve,reject)=>setTimeout(()=>{__liveWrites--;if(__failure===op||__failure===p.databaseId){reject(Error('test rejected '+op));return;}const rows=__DATA[p.databaseId];if(op==='delete'){let i=rows.findIndex(r=>r._id===p.recordId);if(i>=0)rows.splice(i,1);resolve({});return;}let row=op==='add'?{_id:'created-'+__attempts.length}:rows.find(r=>r._id===p.recordId);if(!row){reject(Error('not found'));return;}for(const[k,v]of Object.entries(p.properties))row[k]=Object.values(v)[0];if(op==='add')rows.push(row);resolve({id:row._id});},__delay));}
window.__SMART_PAGE__={database:{query:p=>__failure==='query'?Promise.reject(Error('read denied')):Promise.resolve({results:structuredClone(__DATA[p.databaseId]),hasMore:false,nextCursor:null}),addRecord:p=>__write('add',p),updateRecord:p=>__write('update',p),deleteRecord:p=>__write('delete',p),onUpdated:f=>{}}};</script>'''.replace('SEED',json.dumps(D,ensure_ascii=False))
h=h.replace("<script>\n(function () {\n  'use strict';",fixture+"<script>\n(function () {\n  'use strict';",1)
h=h.replace("  if (document.readyState === 'loading')",'''  window.__test={S:S,OD:OD,reload:reload,detail:openTaskDetail,close:closeModal,oldCreate:openTaskForm,create:openCreate,remove:removeTask,restore:restoreTask,focusPaint:odFocusPaint,focusSave:odFocusSave,notes:odShowNote,backup:odBackup,data:odData};
  if (document.readyState === 'loading')''',1)
results=[]
def expect(v):assert v
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1050});page.set_default_timeout(2500);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  global page
  page.close();page=b.new_page(viewport={'width':1440,'height':1050});page.set_default_timeout(2500);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(h);page.wait_for_timeout(200)
 def test(name,fn):
  try:reset();fn();results.append({'name':name,'passed':True});print('PASS',name)
  except Exception as e:results.append({'name':name,'passed':False,'error':str(e)[:450]});print('FAIL',name,str(e)[:130])
 def conflict():
  page.evaluate("__test.detail('demo-1');__DATA['"+T+"'][0]['任务标题']='另一设备的标题';")
  page.locator('#tdTitle').fill('我的标题草稿');page.locator('#tdTitle').dispatch_event('input');page.locator('#tdTitle').dispatch_event('change');page.wait_for_timeout(1200)
  expect(page.evaluate("__DATA['"+T+"'][0]['任务标题']")=='另一设备的标题');expect('其他设备' in page.locator('#tdDirty').inner_text());expect(page.evaluate("!!localStorage.getItem('oneday.v10.draft.demo-1')"))
 test('same-field conflict refuses overwrite and keeps draft',conflict)
 def disjoint():
  page.evaluate("__test.detail('demo-1');__DATA['"+T+"'][0]['优先级']='低'")
  page.locator('#tdTitle').fill('只修改本地标题');page.locator('#tdTitle').dispatch_event('change');page.wait_for_timeout(400)
  row=page.evaluate("__DATA['"+T+"'][0]");expect(row['任务标题']=='只修改本地标题'and row['优先级']=='低')
 test('unrelated remote field survives local title save',disjoint)
 def closeflush():
  page.evaluate("__test.detail('demo-1')");page.locator('#mdEdit').evaluate("el=>{el.textContent='关闭前刚刚输入的内容';el.dispatchEvent(new Event('input',{bubbles:true}));}");page.evaluate('__test.close()');page.wait_for_timeout(400);expect(page.evaluate("__DATA['"+T+"'][0]['任务详情']").strip()=='关闭前刚刚输入的内容')
 test('closing details flushes pending text before debounce',closeflush)
 def writefail():
  page.evaluate("__failure='add'");page.locator('#odCapture').fill('失败时不能丢失的收集');page.locator('#odCaptureSubmit').click();page.wait_for_timeout(400)
  expect(page.locator('#odCapture').input_value()=='失败时不能丢失的收集');expect(page.evaluate('__attempts.length')==1);expect('保存失败' in page.locator('#odNotice').inner_text());expect(not page.locator('#odCaptureSubmit').is_disabled())
 test('quick capture failure retains text and never auto-retries',writefail)
 def queue():
  page.evaluate("__delay=450;__test.detail('demo-1')");page.locator('#tdTitle').fill('修改一');page.locator('#tdTitle').dispatch_event('change');page.wait_for_timeout(50);page.locator('#tdTitle').fill('修改二');page.locator('#tdTitle').dispatch_event('change');page.wait_for_timeout(1200)
  expect(page.evaluate("__DATA['"+T+"'][0]['任务标题']")=='修改二');expect(page.evaluate('__maxWrites')==1)
 test('rapid edits serialize and preserve latest value',queue)
 def refresh():
  page.evaluate("__failure='query';__test.reload()");page.wait_for_timeout(200);expect(page.evaluate('__test.S.tasks.length')==len(D[T]));expect('读取失败' in page.locator('#odNotice').inner_text())
 test('query failure preserves all-table snapshot',refresh)
 def delete():
  page.evaluate("__DATA['"+T+"'].push({_id:'nested','任务标题':'孙任务','父任务ID':'demo-10'});__test.reload()");page.wait_for_timeout(100)
  page.evaluate("__test.remove('demo-1',()=>{})");page.wait_for_timeout(300);expect(page.evaluate("__DATA['"+T+"'].filter(r=>['demo-1','demo-10','nested'].includes(r._id)).every(r=>r['回收站'])"))
  page.evaluate("__test.reload()");page.wait_for_timeout(100);page.evaluate("__test.restore('demo-1',()=>{})");page.wait_for_timeout(300);expect(page.evaluate("__DATA['"+T+"'].filter(r=>['demo-1','demo-10','nested'].includes(r._id)).every(r=>r['回收站']===false)"))
 test('soft delete and restore include nested descendants',delete)
 def oldretry():
  page.evaluate("__test.oldCreate(null);__failure='add'");page.locator('#fTitle').fill('旧入口失败验证');page.locator('#fSave').click();page.wait_for_timeout(400);expect(page.evaluate('__attempts.length')==1)
 test('legacy create failure does not retry non-idempotent add',oldretry)
 def logfailure():
  page.evaluate("__test.create({});__failure='oneday-logs'");page.locator('#fTitle').fill('任务成功日志失败');page.locator('#fSave').click();page.wait_for_timeout(450)
  expect(page.evaluate("__DATA['"+T+"'].filter(t=>t['任务标题']==='任务成功日志失败').length") ==1);expect(page.locator('#fSave').count()==0);expect('日志' in page.locator('#toastRoot').inner_text())
 test('partial task/log write closes create and reports log failure',logfailure)
 def note():
  page.evaluate("__test.notes('note-1')");page.locator('#odEditNote').click();page.locator('#odNoteEditor').fill('新编辑的便签内容');page.locator('#odNoteSave').click();page.wait_for_timeout(200);expect(page.evaluate("__DATA['"+N+"'][0]['便签内容']")=='新编辑的便签内容')
 test('note preview can open editor and save',note)
 def focus():
  page.evaluate("__test.OD.focus={id:'session-test',duration:1500,remaining:1,startedAt:Date.now()-2000,running:true,taskId:'demo-1',started:true};__test.focusPaint();__test.focusSave();")
  page.wait_for_timeout(200);page.evaluate('__test.focusSave()');page.wait_for_timeout(100);expect(page.evaluate("__DATA['"+N+"'].filter(n=>(n['来源']||'').includes('session-test')).length")==1);expect(page.evaluate('__test.OD.focus.saved'))
 test('focus elapsed time records once after explicit confirmation',focus)
 def backup():
  val=page.evaluate('__test.backup()');expect(len(val['tables'])==7);expect(sum(map(len,val['tables'].values()))==sum(map(len,D.values())))
 test('JSON backup retains seven tables and all record IDs',backup)
 def noop():
  page.evaluate("__test.detail('demo-1');__test.close()");page.wait_for_timeout(300);expect(page.evaluate('__attempts.length')==0)
 test('opening and closing unedited detail causes no writes',noop)
 def dates():
  page.evaluate("__test.detail('demo-1')");page.locator('#tdTabs [data-tdtab="1"]').click();page.locator('#tdPs').fill('');page.locator('#tdPd').fill('');page.locator('#tdPs').dispatch_event('change');page.wait_for_timeout(300);expect(page.evaluate("__DATA['"+T+"'][0]['计划开始时间']===null&&__DATA['"+T+"'][0]['计划截止时间']===null"))
 test('explicit clearing of planned dates uses typed null contract',dates)
 def dialogclose():
  page.evaluate('__test.data()');page.locator('#modalRoot>.mask').last.locator('[data-close]').first.click();expect(page.locator('#odDataCenter').count()==0)
 test('new dialog close button works on touch/click',dialogclose)
 results.append({'name':'no unhandled runtime errors','passed':not errors,'errors':errors});print('RUNTIME ERRORS',errors);b.close()
(R/'docs/verification'/('integrity-'+('green'if all(r['passed']for r in results)else'red')+'.json')).write_text(json.dumps(results,ensure_ascii=False,indent=2));sys.exit(0 if all(r['passed']for r in results)else 1)
