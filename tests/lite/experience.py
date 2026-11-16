"""Chromium end-to-end checks. In-memory SDK/localStorage, no real URL or WorkBuddy login."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,time,os,subprocess
R=Path(__file__).resolve().parents[2];V=R/'docs/lite/verification';V.mkdir(exist_ok=True)
HTML=(R/'dist/lite/OneDay-Lite-本机体验版.html').read_text()
FORMAL=(R/'dist/lite/OneDay-Lite-WorkBuddy正式版.html').read_text()
SHIM='''<script>window.__testMemory={};Object.defineProperty(window,"localStorage",{value:{getItem:k=>Object.hasOwn(window.__testMemory,k)?window.__testMemory[k]:null,setItem:(k,v)=>window.__testMemory[k]=String(v),removeItem:k=>delete window.__testMemory[k],key:i=>Object.keys(window.__testMemory)[i]||null,clear:()=>window.__testMemory={},get length(){return Object.keys(window.__testMemory).length}},configurable:true});</script>'''
checks=[];tests={}
def test(name):
 def register(fn):tests[name]=fn;return fn
 return register
def wait(p):p.wait_for_timeout(160)
def click(p,sel):p.locator(sel).first.click();wait(p)
def js(p,s):return p.evaluate('()=>{'+s+'}')
def eq(a,b):assert a==b,(a,b)
def val(p,s):return p.locator(s).input_value()
def count(p,k):return js(p,f'return OneDayLite.store.data.{k}.length')
def open_task(p,id='lite-t1'):js(p,f'OneDayLite.openTask("{id}")');wait(p)
def open_note(p,id='lite-n1'):
 click(p,'#mobileNav [data-tab="notes"]');click(p,f'[data-act="open-note"][data-id="{id}"]')
def task(p,id='lite-t1'):return js(p,f'return OneDayLite.find("{id}")')
def edit_task_title(p,title):
 content=js(p,'return OneDayLite.detail.editor.getValue()')
 _,separator,rest=content.partition('\n');updated=title+(separator+rest if separator else '')
 p.fill('#taskContentEditor [data-live-md]',updated)
 return updated
@test('navigation-and-calendar')
def _(p):
 eq(p.locator('#mobileNav [data-tab]').all_text_contents(),['任务','笔记']);eq(p.locator('#viewSwitch button').all_text_contents(),['日历','看板']);assert p.locator('.month-grid').count();assert not p.locator('.capture-wrap').is_visible();eq(p.locator('.agenda').count(),0);before=js(p,'return OneDayLite.UI.date');click(p,'[data-act="next"]');assert js(p,'return OneDayLite.UI.date')!=before;click(p,'[data-act="today"]');eq(js(p,'return OneDayLite.UI.date'),js(p,'return OneDayLite.C.localDay()'))

@test('global-new-task-modal-and-persistent')
def _(p):
 n=count(p,'tasks');p.keyboard.press('/');wait(p);assert p.locator('#newTaskBody').is_visible()
 eq(p.locator('#newTaskTitle,#newTaskDate,#newTaskStart,#newTaskEnd').count(),0)
 p.fill('#newTaskBody','整理方案\n\n一段说明');eq(val(p,'#newTaskDuration'),'60');click(p,'#newTaskSave');wait(p)
 eq(count(p,'tasks'),n+1);t=js(p,'return OneDayLite.store.data.tasks.at(-1)');eq(t['任务标题'],'整理方案');eq(t['任务详情'],'整理方案\n\n一段说明');assert not t.get('计划开始时间');assert not t.get('计划截止时间');eq(t['预计时长'],60)
 saved=js(p,'return JSON.parse(localStorage.getItem("oneday.lite.v1.local-data"))');eq(len(saved['tasks']),n+1)

@test('global-new-task-modal-respects-ime-enter')
def _(p):
 p.keyboard.press('/');wait(p);n=count(p,'tasks');p.fill('#newTaskBody','输入法组合中')
 p.locator('#newTaskBody').dispatch_event('keydown',{'key':'Enter','ctrlKey':True,'isComposing':True});wait(p);eq(count(p,'tasks'),n);assert p.locator('#newTaskBody').is_visible()
 p.locator('#newTaskBody').dispatch_event('keydown',{'key':'Enter','ctrlKey':True,'isComposing':False});wait(p);eq(count(p,'tasks'),n+1)

@test('notes-root-has-no-duplicate-create-entry')
def _(p):
 click(p,'#mobileNav [data-tab="notes"]')
 eq(p.locator('#mobileNav [data-tab]').all_text_contents(),['任务','笔记'])
 assert not p.locator('.capture-wrap').is_visible()
 eq(p.locator('#workspace [data-act="capture-focus"]').count(),0)

@test('global-create-sheet-defaults-to-current-root-type')
def _(p):
 click(p,'#mobileNav [data-tab="notes"]');click(p,'#mobileNav [data-act="global-create"]')
 assert p.locator('.creation-sheet').is_visible()
 eq(p.locator('[data-create-kind="note"]').get_attribute('aria-selected'),'true')
 p.keyboard.press('Escape');wait(p)
 click(p,'#mobileNav [data-tab="tasks"]');click(p,'#mobileNav [data-act="global-create"]')
 eq(p.locator('[data-create-kind="task"]').get_attribute('aria-selected'),'true')

@test('slash-opens-contextual-creation-sheet')
def _(p):
 click(p,'#mobileNav [data-tab="notes"]');p.keyboard.press('/');wait(p);eq(p.locator('[data-create-kind="note"]').get_attribute('aria-selected'),'true');p.keyboard.press('Escape');wait(p);click(p,'#mobileNav [data-tab="tasks"]');p.keyboard.press('/');wait(p);eq(p.locator('[data-create-kind="task"]').get_attribute('aria-selected'),'true')

@test('note-opens-full-bottom-sheet-with-live-editor')
def _(p):
 click(p,'#mobileNav [data-tab="notes"]');click(p,'[data-act="open-note"][data-id="lite-n1"]')
 assert p.locator('.note-sheet').is_visible()
 assert p.locator('.note-sheet [data-live-md]').is_visible()
 sheet=p.locator('.note-sheet').bounding_box();nav=p.locator('#mobileNav').bounding_box();assert sheet and nav
 assert sheet['y'] < nav['y'] and sheet['y']+sheet['height'] >= nav['y']+nav['height']-2

@test('notes-filter-and-conversion')
def _(p):
 click(p,'#mobileNav [data-tab="notes"]');click(p,'[data-act="notes-filter"][data-value="灵感"]');eq(p.locator('.note-card').count(),2);n=count(p,'tasks');click(p,'[data-act="convert-note"][data-id="lite-n2"]');eq(count(p,'tasks'),n+1);note=js(p,'return OneDayLite.store.get("notes","lite-n2")');assert note['关联任务ID'];assert '会议' in p.locator('#detailTitle').inner_text();eq(js(p,'return OneDayLite.body(OneDayLite.find(OneDayLite.store.get("notes","lite-n2")["关联任务ID"]))'),note['便签内容'])
@test('note-capture-edit-pin-archive')
def _(p):
 click(p,'#mobileNav [data-tab="notes"]');n=count(p,'notes');click(p,'#mobileNav [data-act="global-create"]');p.fill('#newNoteBody','## 一条新的想法\n\n长期保存');click(p,'#newNoteSave');wait(p);eq(count(p,'notes'),n+1);id=js(p,'return OneDayLite.store.data.notes.at(-1)._id');click(p,f'[data-act="open-note"][data-id="{id}"]');p.fill('.note-sheet [data-live-md]','新的想法\n\n- [ ] 再补一行');p.wait_for_timeout(900);saved=js(p,f'return OneDayLite.store.get("notes","{id}")["便签内容"]');assert '新的想法' in saved and '- [ ] 再补一行' in saved;click(p,'#notePin');assert js(p,f'return OneDayLite.store.get("notes","{id}")["置顶"]');p.keyboard.press('Escape');wait(p);click(p,f'[data-act="note-more"][data-id="{id}"]');click(p,'[data-nchoice="archive"]');assert js(p,f'return OneDayLite.store.get("notes","{id}")["便签状态"]')=='已归档'
@test('task-title-autosave-preserves-plan')
def _(p):
 before=task(p);open_task(p);updated=edit_task_title(p,'改了标题，但时间不变');p.wait_for_timeout(850);t=task(p)
 eq(t['任务标题'],'改了标题，但时间不变');eq(t['计划开始时间'],before['计划开始时间']);eq(t['计划截止时间'],before['计划截止时间']);eq(t['任务详情'],updated);assert before['任务详情'] in t['任务详情']

@test('task-body-and-checkbox')
def _(p):
 open_task(p);p.fill('#taskContentEditor [data-live-md]','## 工作计划\n- [ ] 完成第一步\n\n直接输入的普通文字');p.wait_for_timeout(850)
 eq(task(p)['任务标题'],'工作计划');eq(task(p)['任务详情'],'## 工作计划\n- [ ] 完成第一步\n\n直接输入的普通文字')
 click(p,'#taskContentEditor .md-check');p.wait_for_timeout(850);assert '- [x] 完成第一步' in task(p)['任务详情'];assert '普通文字' in task(p)['任务详情']

@test('worklog-and-local-draft')
def _(p):
 open_task(p);p.fill('#worklogInput','已确认两个关键问题，下一步做原型');eq(js(p,'return OneDayLite.read("worklog.lite-t1")'),'已确认两个关键问题，下一步做原型');n=count(p,'notes');p.press('#worklogInput','Control+Enter');wait(p);eq(count(p,'notes'),n+1);eq(val(p,'#worklogInput'),'');note=js(p,'return OneDayLite.store.data.notes.at(-1)');eq(note['关联任务ID'],'lite-t1');eq(note['便签分类'],'记录');assert note['创建时间']
@test('pause-complete-reopen-and-logs')
def _(p):
 open_task(p);n=count(p,'logs');before=js(p,'return OneDayLite.time("lite-t1").doing');click(p,'#detailStart');eq(task(p)['任务状态'],'暂停');eq(count(p,'logs'),n+1);a=js(p,'return OneDayLite.time("lite-t1").doing');p.wait_for_timeout(1100);eq(js(p,'return OneDayLite.time("lite-t1").doing'),a);assert abs(a-before)<5000;click(p,'#detailDone');eq(task(p)['任务状态'],'完成');click(p,'#detailActions [data-next="收集（未开始）"]');eq(task(p)['任务状态'],'收集（未开始）')
@test('start-pauses-other-task')
def _(p):
 open_task(p,'lite-t2');click(p,'#detailStart');assert p.locator('#pauseOthers').count();click(p,'#pauseOthers');eq(task(p,'lite-t1')['任务状态'],'暂停');eq(task(p,'lite-t2')['任务状态'],'进行中')
@test('plan-nochange-precision-and-clear')
def _(p):
 js(p,'const t=OneDayLite.find("lite-t1");return OneDayLite.store.patch("tasks",t._id,{"计划开始时间":{date:t["计划开始时间"].slice(0,17)+"34.123Z"}},t)');before=task(p);open_task(p);click(p,'[data-act="plan"]');click(p,'#savePlan');eq(task(p)['计划开始时间'],before['计划开始时间']);click(p,'[data-act="plan"]');click(p,'#clearPlan');assert not task(p)['计划开始时间'];assert not task(p)['计划截止时间']
@test('manual-time-log-and-invalid-range')
def _(p):
 open_task(p);click(p,'[data-act="time-detail"]');click(p,'#addTime');p.fill('#logStart','2026-01-02T12:00');p.fill('#logEnd','2026-01-02T11:00');n=count(p,'logs');click(p,'#saveLog');eq(count(p,'logs'),n);assert p.locator('.dialog-error:not([hidden])').count();p.fill('#logEnd','2026-01-02T12:30');click(p,'#saveLog');eq(count(p,'logs'),n+1);log=js(p,'return OneDayLite.store.data.logs.at(-1)');eq(log['持续时长'],.5)
@test('search-and-shortcuts')
def _(p):
 p.keyboard.press('Control+k');wait(p);p.fill('#searchInput','访谈');wait(p);assert p.locator('#searchResults').inner_text().find('访谈')>=0;p.press('#searchInput','Enter');wait(p);assert '访谈' in p.locator('#detailTitle').inner_text();p.keyboard.press('Escape');wait(p);assert not p.locator('#detailTitle').count();p.keyboard.press('b');wait(p);assert p.locator('.board').count()
@test('board-mobile-renders-four-columns')
def _(p):
 p.set_viewport_size({'width':390,'height':844});click(p,'#viewSwitch [data-view="board"]');eq(p.locator('.board-col').count(),4);assert p.locator('.board').is_visible();assert js(p,'return document.documentElement.scrollWidth<=innerWidth')

@test('no-body-overflow-mobile-detail')
def _(p):
 for w in [360,390,768,1440]:
  p.set_viewport_size({'width':w,'height':844});wait(p);assert js(p,'return document.documentElement.scrollWidth<=innerWidth'),w
 p.set_viewport_size({'width':390,'height':844});open_task(p);assert p.locator('#detailDone').is_visible();rect=p.locator('#detailDone').bounding_box();assert rect['y']+rect['height']<=844;assert js(p,'return document.documentElement.scrollWidth<=innerWidth')
@test('stats-themes-and-download')
def _(p):
 js(p,'OneDayLite.openStats()');wait(p);assert p.locator('#statsContent').inner_text().strip();assert '小时' in p.inner_text('#statsContent') or '分钟' in p.inner_text('#statsContent');p.keyboard.press('Escape');wait(p);click(p,'[data-act="settings"]');p.select_option('#themeSelect','night');eq(p.locator('html').get_attribute('data-theme'),'night')
 with p.expect_download(timeout=2500) as dl:click(p,'#exportBackup')
 assert dl.value.suggested_filename.endswith('.json')
# Above compact with statement cannot be on one line with other statements; fixed below by build script.
@test('formal-does-not-silently-create-local-database')
def _(p):
 assert p.locator('.error-page').is_visible();eq(count(p,'tasks'),0);assert not js(p,'return !!window.__ONEDAY_LOCAL__');assert p.locator('#captureSubmit').is_disabled()
@test('title-save-failure-draft-is-retained')
def _(p):
 open_task(p);js(p,'window.__oldUpdate=__SMART_PAGE__.database.updateRecord;__SMART_PAGE__.database.updateRecord=async()=>{throw Error("test write failure")};');edit_task_title(p,'不能丢掉的标题');p.wait_for_timeout(900);assert task(p)['任务标题']!='不能丢掉的标题';draft=js(p,'return OneDayLite.read("draft.tasks.lite-t1")');assert draft and draft['fields']['任务标题']=='不能丢掉的标题';assert '失败' in p.inner_text('#detailSaveState') or '未保存' in p.inner_text('#detailSaveState');js(p,'__SMART_PAGE__.database.updateRecord=window.__oldUpdate;return OneDayLite.detail.session.flush()');eq(task(p)['任务标题'],'不能丢掉的标题')
@test('failed-refresh-keeps-snapshot')
def _(p):
 n=count(p,'tasks');js(p,'window.__oldQuery=__SMART_PAGE__.database.query;__SMART_PAGE__.database.query=async()=>{throw Error("test read failure")};');click(p,'[data-act="settings"]');click(p,'#settingsRefresh');eq(count(p,'tasks'),n);assert p.locator('#connectionNotice').is_visible()

@test('new-task-modal-keeps-unsubmitted-draft')
def _(p):
 p.keyboard.press('/');wait(p);p.fill('#newTaskBody','还没写完的任务\n\n写到一半的说明')
 p.locator('#newTaskDuration').evaluate("el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));}");p.keyboard.press('Escape');wait(p);p.keyboard.press('/');wait(p)
 eq(p.locator('#newTaskBody').inner_text(),'还没写完的任务\n\n写到一半的说明');eq(val(p,'#newTaskDuration'),'80');n=count(p,'tasks');click(p,'#newTaskSave');eq(count(p,'tasks'),n+1)

@test('new-task-draft-in-export')
def _(p):
 p.keyboard.press('/');wait(p);p.fill('#newTaskBody','别丢掉我还没提交的记录\n\n草稿正文');p.keyboard.press('Escape');wait(p);click(p,'[data-act="settings"]')
 with p.expect_download(timeout=2500) as dl:click(p,'#exportDrafts')
 data=json.loads(Path(dl.value.path()).read_text());eq(data['drafts']['newtask.root']['title'],'别丢掉我还没提交的记录');eq(data['drafts']['newtask.root']['body'],'别丢掉我还没提交的记录\n\n草稿正文')

@test('new-subtask-completion-and-parent-safety')
def _(p):
 open_task(p);click(p,'[data-act="new-subtask"]');p.fill('#newTaskBody','画出第一条用户路径');click(p,'#newTaskSave');t=js(p,'return OneDayLite.store.data.tasks.at(-1)');eq(t['父任务ID'],'lite-t1');eq(t['任务类型'],'子任务');assert '画出第一条用户路径' in p.inner_text('#detailSubtasks');click(p,'#detailDone');assert p.locator('#confirmYes').is_visible();click(p,'#confirmNo');eq(task(p)['任务状态'],'进行中')
@test('trash-restore-does-not-delete-history')
def _(p):
 open_task(p,'lite-t2');n=count(p,'logs');click(p,'#detailMore');click(p,'[data-choice="trash"]');click(p,'#confirmYes');assert task(p,'lite-t2')['回收站'];eq(count(p,'logs'),n);click(p,'[data-act="settings"]');click(p,'#settingsRecycle');click(p,'[data-restore-id="lite-t2"]');assert not task(p,'lite-t2')['回收站']
@test('board-pointer-drag-live-reorder-and-persist')
def _(p):
 click(p,'#viewSwitch [data-view="board"]')
 src=p.locator('[data-board-task-id="lite-t2"]');target=p.locator('[data-board-task-id="lite-t3"]');assert src.is_visible() and target.is_visible()
 before=target.bounding_box();a=src.bounding_box();b=target.bounding_box();assert a and b
 p.mouse.move(a['x']+a['width']/2,a['y']+20);p.mouse.down();p.mouse.move(a['x']+a['width']/2,a['y']+42,steps=3);p.mouse.move(b['x']+b['width']/2,b['y']+8,steps=8);p.wait_for_timeout(80)
 assert p.locator('.board-drag-ghost').is_visible();ph=p.locator('.board-drop-placeholder');assert ph.is_visible();eq(ph.locator('xpath=..').get_attribute('data-board-list-status'),'暂停')
 after=target.bounding_box();assert after and after['y']>before['y']+8
 assert p.locator('.board-flip-moving').count()>=1
 p.mouse.up();p.wait_for_timeout(520)
 eq(task(p,'lite-t2')['任务状态'],'暂停')
 ordered=js(p,'return OneDayLite.sort(OneDayLite.tasks().filter(t=>t["任务状态"]==="暂停")).map(t=>[t._id,t["排序序号"]])')
 assert all(isinstance(row[1],(int,float)) for row in ordered)
 eq([row[1] for row in ordered],list(range(len(ordered))))

@test('board-pointer-drag-escape-cancels-without-write')
def _(p):
 click(p,'#viewSwitch [data-view="board"]');before=task(p,'lite-t2').copy()
 src=p.locator('[data-board-task-id="lite-t2"]');target=p.locator('[data-board-task-id="lite-t3"]');a=src.bounding_box();b=target.bounding_box();assert a and b
 p.mouse.move(a['x']+a['width']/2,a['y']+20);p.mouse.down();p.mouse.move(b['x']+b['width']/2,b['y']+8,steps=8);p.wait_for_timeout(70)
 assert p.locator('.board-drop-placeholder').is_visible();p.keyboard.press('Escape');p.wait_for_timeout(180);p.mouse.up()
 eq(p.locator('.board-drag-ghost').count(),0);eq(p.locator('.board-drop-placeholder').count(),0)
 after=task(p,'lite-t2');eq(after['任务状态'],before['任务状态']);eq(after.get('排序序号'),before.get('排序序号'))

@test('concurrent-title-edit-refuses-overwrite')
def _(p):
 open_task(p);js(p,'const d=JSON.parse(localStorage.getItem("oneday.lite.v1.local-data"));d.tasks[0]["任务标题"]="另一台设备的标题";localStorage.setItem("oneday.lite.v1.local-data",JSON.stringify(d));');edit_task_title(p,'我在这里写的标题');p.wait_for_timeout(850);saved=js(p,'return JSON.parse(localStorage.getItem("oneday.lite.v1.local-data")).tasks[0]["任务标题"]');eq(saved,'另一台设备的标题');assert '未保存' in p.inner_text('#detailSaveState');assert js(p,'return !!OneDayLite.read("draft.tasks.lite-t1")')
@test('partial-status-success-keeps-repair-segment')
def _(p):
 open_task(p);js(p,'const orig=__SMART_PAGE__.database.addRecord;__SMART_PAGE__.database.addRecord=async p=>{if(p.databaseId===OneDayLiteStore.IDS.logs)throw Error("log rejected");return orig(p)};');click(p,'#detailStart');eq(task(p)['任务状态'],'暂停');assert js(p,'return !!OneDayLite.read("repair.lite-t1")');assert '时间日志未写入' in p.inner_text('#toastRoot')
@test('failed-new-record-does-not-clear-input')
def _(p):
 n=count(p,'tasks');p.keyboard.press('/');wait(p);p.fill('#newTaskBody','断网时写下的任务');js(p,'__SMART_PAGE__.database.addRecord=async()=>{throw Error("offline")};');click(p,'#newTaskSave');p.wait_for_timeout(260)
 eq(count(p,'tasks'),n);eq(p.locator('#newTaskBody').inner_text(),'断网时写下的任务');draft=js(p,'return OneDayLite.read("newtask.root")');assert draft and draft['title']=='断网时写下的任务';eq(draft['body'],'断网时写下的任务')

@test('log-edit-preserves-unchanged-seconds')
def _(p):
 js(p,'const l=OneDayLite.store.data.logs[0];return OneDayLite.store.patch("logs",l._id,{"开始时间":{date:l["开始时间"].slice(0,17)+"23.456Z"}},l)');before=js(p,'return OneDayLite.store.data.logs[0]');open_task(p);click(p,'[data-act="time-detail"]');click(p,'[data-edit-log="lite-l1"]');click(p,'#saveLog');eq(js(p,'return OneDayLite.store.get("logs","lite-l1")["开始时间"]'),before['开始时间'])
@test('correct-current-stops-with-historical-end')
def _(p):
 open_task(p);click(p,'[data-act="time-detail"]');click(p,'#correctCurrent');end=js(p,'return OneDayLite.C.toLocal(new Date(Date.now()-5*60000).toISOString())');p.fill('#correctEnd',end);click(p,'#correctSave');eq(task(p)['任务状态'],'暂停');assert js(p,'return Date.now()-Date.parse(OneDayLite.find("lite-t1")["状态开始时间"])')>=300000
@test('malicious-markdown-is-text-not-executable')
def _(p):
 open_task(p);p.fill('#taskContentEditor [data-live-md]','<img src=x onerror="window.__xss=true">\n[链接](javascript:alert(1))\n**保留加粗**');p.wait_for_timeout(850)
 assert not js(p,'return !!window.__xss');assert p.locator('#taskContentEditor img').count()==0;assert p.locator('#taskContentEditor a').count()==0;assert p.locator('#taskContentEditor strong').inner_text()=='保留加粗'

@test('fresh-mobile-starts-full-month-calendar')
def _(p):
 assert p.locator('.month-grid').is_visible();assert p.locator('.week-column').count()==0;assert not p.locator('.capture-wrap').is_visible();assert p.locator('#mobileNav').is_visible();assert js(p,'return document.documentElement.scrollWidth<=innerWidth')

@test('single-day-timeline-plan-interaction')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 # Add one child so the desktop dual-axis state is exercised.
 js(p,'return OneDayLite.store.createTask({title:"时间轴子任务",parent:"lite-t1",date:OneDayLite.C.localDay(),start:"10:15",end:"10:45"})')
 wait(p)
 click(p,f'.day[data-date="{ds}"] .day-heading')
 assert p.locator('.day-timeline-dialog').is_visible()
 eq(p.locator('.day-main-pane .day-hour-label').count(),24)
 card=p.locator('.day-task-card[data-task-id="lite-t1"]').first
 assert card.is_visible();eq(card.get_attribute('data-start'),'600');eq(card.get_attribute('data-end'),'660')
 p.locator('.day-main-pane .day-task-card[data-task-id="lite-t1"]').first.dblclick();p.wait_for_timeout(220)
 assert p.locator('.day-sub-pane').is_visible()
 assert p.locator('.day-sub-pane .day-task-card').filter(has_text='时间轴子任务').count()==1
 # Property edits save back to the task and repaint the timeline.
 click(p,'[data-day-action="tab"][data-tab="props"]')
 p.fill('[data-day-field="start"]',ds+'T11:00');p.dispatch_event('[data-day-field="start"]','change');wait(p)
 eq(task(p)['计划开始时间'],ds+'T11:00:00Z')
 eq(p.locator('.day-task-card[data-task-id="lite-t1"]').first.get_attribute('data-start'),'660')
 # Dragging the card by one hour updates both plan endpoints and keeps duration.
 box=p.locator('.day-task-card[data-task-id="lite-t1"]').first.bounding_box();assert box
 p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);p.mouse.down();p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2+48,steps=5);p.mouse.up();wait(p)
 eq(task(p)['计划开始时间'],ds+'T12:00:00Z');eq(task(p)['计划截止时间'],ds+'T13:00:00Z')
 # Bottom resize handle snaps to 10 minutes.
 card=p.locator('.day-task-card[data-task-id="lite-t1"]').first;handle=card.locator('.day-resize.end');hb=handle.bounding_box();assert hb
 p.mouse.move(hb['x']+hb['width']/2,hb['y']+hb['height']/2);p.mouse.down();p.mouse.move(hb['x']+hb['width']/2,hb['y']+hb['height']/2+24,steps=4);p.mouse.up();wait(p)
 eq(task(p)['计划截止时间'],ds+'T13:30:00Z')
 assert '12:00' in p.inner_text('[data-day-field-label="plan"]')

@test('single-day-timeline-blank-range-creates-task')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay())')
 p.wait_for_timeout(300)
 track=p.locator('.day-main-pane .day-timeline-track');box=track.bounding_box();assert box
 # 13:00 -> 14:30, 48 px per hour.
 y1=box['y']+13*48+2;y2=box['y']+14.5*48+2;x=box['x']+box['width']*.72
 p.mouse.move(x,y1);p.mouse.down();p.mouse.move(x,y2,steps=6);p.mouse.up();wait(p)
 assert p.locator('#newTaskBody').is_visible();eq(val(p,'#newTaskDuration'),'90');timing=p.locator('#newTaskTiming').inner_text();assert ds in timing and '13:00' in timing and '14:30' in timing
 p.fill('#newTaskBody','划出来的任务');click(p,'#newTaskSave');wait(p)
 t=js(p,'return OneDayLite.store.data.tasks.at(-1)');eq(t['计划开始时间'],ds+'T13:00:00Z');eq(t['计划截止时间'],ds+'T14:30:00Z')

@test('single-day-timeline-mobile-keeps-axis-and-detail-together')
def _(p):
 p.set_viewport_size({'width':390,'height':844});wait(p)
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay())');p.wait_for_timeout(240)
 assert p.locator('.day-main-pane').is_visible();assert p.locator('.day-detail-panel').is_visible();assert js(p,'return document.documentElement.scrollWidth<=innerWidth')
 p.locator('.day-main-pane .day-task-card[data-task-id="lite-t1"]').first.click();p.wait_for_timeout(240)
 assert p.locator('.day-main-pane').is_visible();assert p.locator('.day-detail-panel').is_visible();eq(p.locator('[data-day-task-title]').inner_text(),'把产品方案打磨到可讨论的版本')

@test('task-attributes-schema-old-host-disables-only-new-controls')
def _(p):
 js(p,'OneDayLite.store.capabilities.taskFields.clear()')
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay(),"lite-t1")');wait(p)
 click(p,'[data-day-action="tab"][data-tab="props"]')
 assert not p.locator('[data-day-field="start"]').is_disabled()
 assert not p.locator('[data-day-field="end"]').is_disabled()
 assert p.locator('[data-day-field="deadline"]').is_disabled()
 assert p.locator('[data-day-field="estimate"]').is_disabled()
 assert p.locator('[data-day-field="parallel"]').is_disabled()
 assert 'WorkBuddy' in p.inner_text('.day-schema-help')

@test('single-day-timeline-parks-all-day-task')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()');js(p,'return OneDayLite.store.createTask({title:"全天待安排",date:OneDayLite.C.localDay()})');wait(p);pid=js(p,'return OneDayLite.store.data.tasks.at(-1)._id');js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay())');p.wait_for_timeout(220);assert p.locator(f'[data-day-park-id="{pid}"]').is_visible();eq(p.locator(f'.day-main-pane .day-task-card[data-task-id="{pid}"]').count(),0)

@test('single-day-timeline-main-sub-scrolls-stay-synchronized')
def _(p):
 js(p,'return OneDayLite.store.createTask({title:"晚间子任务",parent:"lite-t1",date:OneDayLite.C.localDay(),start:"18:00",end:"18:30"})');wait(p)
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay(),"lite-t1")');p.wait_for_timeout(220)
 p.locator('.day-main-pane .day-task-card[data-task-id="lite-t1"]').first.dblclick();p.wait_for_timeout(220)
 main=p.locator('.day-main-pane .day-timeline-scroll');sub=p.locator('.day-sub-pane .day-timeline-scroll');assert main.is_visible() and sub.is_visible()
 main.evaluate('(e)=>{e.scrollTop=430;e.dispatchEvent(new Event("scroll"))}');wait(p)
 assert abs(main.evaluate('e=>e.scrollTop')-sub.evaluate('e=>e.scrollTop'))<2
 sub.evaluate('(e)=>{e.scrollTop=650;e.dispatchEvent(new Event("scroll"))}');wait(p)
 assert abs(main.evaluate('e=>e.scrollTop')-sub.evaluate('e=>e.scrollTop'))<2


@test('calendar-shell-uses-dense-mobile-pattern-on-desktop')
def _(p):
 p.set_viewport_size({'width':1440,'height':960});wait(p)
 assert p.locator('#mobileNav').is_visible()
 assert not p.locator('#desktopNav').is_visible()
 assert not p.locator('.capture-wrap').is_visible()
 assert not p.locator('.workspace-heading').is_visible()
 assert p.locator('.topbar #viewSwitch').is_visible()
 eq(p.locator('.topbar #viewSwitch button').all_text_contents(),['日历','看板'])
 assert p.locator('.calendar-main .month-grid').is_visible()
 eq(p.locator('.agenda').count(),0)

@test('calendar-day-cell-shows-execution-water')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 cell=p.locator(f'.day[data-date="{ds}"]')
 assert cell.is_visible()
 water=cell.locator('.day-water-fill')
 assert water.count()==1
 assert float(water.get_attribute('data-exec-ms') or 0)>=0
 assert '--water:' in (cell.get_attribute('style') or '')
 empty=p.locator('.day-water-fill[data-exec-ms="0"]').first
 assert empty.count()==1
 eq(empty.evaluate('e=>getComputedStyle(e).display'),'none')

@test('calendar-day-opens-bottom-sheet-over-nav')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 click(p,f'.day[data-date="{ds}"] .day-heading');p.wait_for_timeout(220)
 sheet=p.locator('.day-timeline-dialog')
 assert sheet.is_visible()
 box=sheet.bounding_box();assert box
 assert box['y']>0 and abs((box['y']+box['height'])-p.evaluate('innerHeight'))<3
 assert p.locator('.day-timeline-backdrop').is_visible()
 assert p.locator('#mobileNav').is_visible()
 # The sheet/backdrop visually sits above and captures the bottom nav region.
 eq(js(p,'const e=document.elementFromPoint(innerWidth/2,innerHeight-12);return !!e.closest(".day-timeline-backdrop")'),True)
 assert p.locator('.day-timeline-summary [data-day-create]').count()==0

@test('day-sheet-keeps-axis-and-detail-visible-on-mobile')
def _(p):
 p.set_viewport_size({'width':390,'height':844});wait(p)
 ds=js(p,'return OneDayLite.C.localDay()')
 click(p,f'.day[data-date="{ds}"] .day-heading')
 assert p.locator('.day-main-pane').is_visible()
 assert p.locator('.day-detail-panel').is_visible()
 eq(p.locator('.day-mobile-switch').count(),0)
 card=p.locator('.day-main-pane .day-task-card[data-task-id="lite-t1"]').first
 p.locator('.day-main-pane .day-task-card[data-task-id="lite-t1"]').first.click();p.wait_for_timeout(240)
 assert p.locator('.day-detail-panel').is_visible()
 eq(p.locator('[data-day-task-title]').inner_text(),'把产品方案打磨到可讨论的版本')
 assert p.locator('.day-main-pane').is_visible()

@test('day-sheet-double-click-expands-child-axis-only')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 js(p,'return OneDayLite.store.createTask({title:"时间轴子任务",parent:"lite-t1",date:OneDayLite.C.localDay(),start:"10:15",end:"10:45"})');wait(p)
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay())');wait(p)
 eq(p.locator('.day-sub-pane').count(),0)
 card=p.locator('.day-main-pane .day-task-card[data-task-id="lite-t1"]').first
 card.click();wait(p)
 eq(p.locator('.day-sub-pane').count(),0)
 card=p.locator('.day-main-pane .day-task-card[data-task-id="lite-t1"]').first
 card.dblclick();wait(p)
 assert p.locator('.day-sub-pane').is_visible()
 assert p.locator('.day-detail-panel').is_visible()
 assert p.locator('.day-sub-pane .day-task-card').filter(has_text='时间轴子任务').count()==1
 eq(js(p,'return OneDayLite.modalStack.length'),1)

@test('slash-and-bottom-plus-open-new-task-dialog')
def _(p):
 assert not p.locator('.capture-wrap').is_visible()
 p.keyboard.press('/');wait(p)
 assert p.locator('#newTaskBody').is_visible()
 p.keyboard.press('Escape');wait(p)
 click(p,'#mobileNav [data-act="global-create"]')
 assert p.locator('#newTaskBody').is_visible()


@test('day-sheet-detail-tabs-swipe-horizontally')
def _(p):
 p.set_viewport_size({'width':390,'height':844});wait(p)
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay(),"lite-t1")');p.wait_for_timeout(220)
 eq(p.locator('.day-detail-tabs button.on').inner_text(),'内容')
 swipe="""e=>{const a=new Event('touchstart',{bubbles:true});Object.defineProperty(a,'touches',{value:[{clientX:250,clientY:300}]});e.dispatchEvent(a);const b=new Event('touchend',{bubbles:true});Object.defineProperty(b,'changedTouches',{value:[{clientX:150,clientY:302}]});e.dispatchEvent(b);}"""
 p.locator('[data-day-swipe="detail"]').evaluate(swipe);p.wait_for_timeout(120)
 eq(p.locator('.day-detail-tabs button.on').inner_text(),'属性')
 p.locator('[data-day-swipe="detail"]').evaluate(swipe);p.wait_for_timeout(120)
 eq(p.locator('.day-detail-tabs button.on').inner_text(),'日志')

@test('day-sheet-hides-global-create-and-slash-does-not-duplicate-entry')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()');click(p,f'.day[data-date="{ds}"] .day-heading');p.wait_for_timeout(220)
 assert p.locator('.day-timeline-dialog').is_visible()
 assert p.locator('.day-timeline-summary [data-day-create]').count()==0
 p.keyboard.press('/');p.wait_for_timeout(100)
 assert p.locator('#newTaskBody').count()==0
 eq(js(p,'return OneDayLite.modalStack.length'),1)

@test('live-markdown-editor-keeps-one-canonical-value')
def _(p):
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay(),"lite-t1")');p.wait_for_timeout(220)
 ed=p.locator('[data-live-md]')
 assert ed.is_visible()
 ed.click()
 p.keyboard.press('Control+a')
 p.keyboard.type('## 标题\n- [ ] 检查项')
 p.wait_for_timeout(750)
 assert '标题' in ed.inner_text()
 assert '## 标题' in task(p)['任务详情']

@test('document-upload-does-not-fake-success-when-host-lacks-capability')
def _(p):
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay(),"lite-t1")');p.wait_for_timeout(220)
 js(p,'delete __SMART_PAGE__.database.uploadFile')
 before=task(p)['任务详情']
 p.locator('[data-live-md-file]').set_input_files({'name':'sample.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 sample'})
 p.wait_for_timeout(260)
 assert 'sample.pdf' not in task(p)['任务详情']
 eq(task(p)['任务详情'],before)
 assert '文档附件上传' in p.locator('#toastRoot').inner_text()

@test('day-sheet-task-detail-edits-title-body-and-attributes-in-place')
def _(p):
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay(),"lite-t1")');p.wait_for_timeout(220)
 assert p.locator('[data-day-task-title]').is_visible();eq(p.locator('[data-task-title-editor]').count(),0)
 ed=p.locator('[data-day-editor-host] [data-live-md]');ed.fill('改过的标题\n\n更新后的 **Markdown** 内容');p.wait_for_timeout(750)
 click(p,'[data-day-action="tab"][data-tab="props"]')
 p.select_option('[data-day-field="priority"]','低');p.dispatch_event('[data-day-field="priority"]','change')
 p.fill('[data-day-field="estimate"]','90');p.dispatch_event('[data-day-field="estimate"]','change');p.wait_for_timeout(360)
 eq(task(p)['任务标题'],'改过的标题');assert 'Markdown' in task(p)['任务详情'];eq(task(p)['优先级'],'低');eq(task(p)['预计时长'],90)

@test('day-sheet-unscheduled-shelf-uses-estimate-when-dropped')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 js(p,'return OneDayLite.store.createTask({title:"当天未定时",date:OneDayLite.C.localDay(),estimate:90})');wait(p)
 tid=js(p,'return OneDayLite.store.data.tasks.at(-1)._id')
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay())');p.wait_for_timeout(220)
 chip=p.locator(f'[data-day-park-id="{tid}"]');assert chip.is_visible();assert '待分配时间' in p.inner_text('.day-parking')
 # simulate HTML5 drop at 13:00
 data=p.evaluate_handle('()=>new DataTransfer()')
 chip.dispatch_event('dragstart',{'dataTransfer':data})
 track=p.locator('.day-main-pane .day-timeline-track');box=track.bounding_box();assert box
 track.dispatch_event('dragover',{'clientY':box['y']+13*48,'dataTransfer':data})
 track.dispatch_event('drop',{'clientY':box['y']+13*48,'dataTransfer':data});p.wait_for_timeout(320)
 t=task(p,tid);eq(t['计划开始时间'],ds+'T13:00:00Z');eq(t['计划截止时间'],ds+'T14:30:00Z')

@test('single-track-conflict-does-not-persist-until-resolution')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 # Put t2 immediately after t1, then drag it into t1.
 js(p,'const t=OneDayLite.find("lite-t2");return OneDayLite.store.patch("tasks","lite-t2",{"计划开始时间":{date:OneDayLite.C.localDay()+"T12:00:00Z"},"计划截止时间":{date:OneDayLite.C.localDay()+"T13:00:00Z"}},t)');wait(p)
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay())');p.wait_for_timeout(420)
 before=task(p,'lite-t2')['计划开始时间'];card=p.locator('.day-main-pane .day-task-card[data-task-id="lite-t2"]').first;box=card.bounding_box();assert box
 p.mouse.move(box['x']+box['width']*.4,box['y']+box['height']*.5);p.mouse.down();p.mouse.move(box['x']+box['width']*.4,box['y']+box['height']*.5-72,steps=6);p.mouse.up();p.wait_for_timeout(220)
 assert p.locator('[data-timeline-conflict]').is_visible();eq(task(p,'lite-t2')['计划开始时间'],before)
 click(p,'[data-conflict-action="cancel"]');eq(task(p,'lite-t2')['计划开始时间'],before)

@test('explicit-parallel-resolution-renders-secondary-lane')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 js(p,'const t=OneDayLite.find("lite-t2");return OneDayLite.store.patch("tasks","lite-t2",{"计划开始时间":{date:OneDayLite.C.localDay()+"T12:00:00Z"},"计划截止时间":{date:OneDayLite.C.localDay()+"T13:00:00Z"}},t)');wait(p)
 js(p,'OneDayLite.openDayTimeline(OneDayLite.C.localDay())');p.wait_for_timeout(420)
 card=p.locator('.day-main-pane .day-task-card[data-task-id="lite-t2"]').first;box=card.bounding_box();assert box
 p.mouse.move(box['x']+box['width']*.4,box['y']+box['height']*.5);p.mouse.down();p.mouse.move(box['x']+box['width']*.4,box['y']+box['height']*.5-72,steps=6);p.mouse.up();p.wait_for_timeout(220)
 assert p.locator('[data-timeline-conflict]').is_visible();click(p,'[data-conflict-action="parallel"]');p.wait_for_timeout(360)
 assert task(p,'lite-t2')['允许并行'] is True
 assert p.locator('.day-task-card[data-task-id="lite-t2"][data-lane="parallel"]').is_visible()


@test('calendar-cards-stay-separated-at-390px')
def _(p):
 p.set_viewport_size({'width':390,'height':844});wait(p)
 cells=p.locator('.month-grid .day');a=cells.nth(0).bounding_box();b=cells.nth(1).bounding_box();assert a and b
 assert b['x']-(a['x']+a['width'])>=2
 style=cells.nth(0).evaluate('e=>getComputedStyle(e)')
 assert float(cells.nth(0).evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)'))>0
 assert float(cells.nth(0).evaluate('e=>parseFloat(getComputedStyle(e).borderTopWidth)'))>=1

@test('theme-switch-keeps-layout-and-changes-material')
def _(p):
 before=p.locator('.month-grid').bounding_box();assert before
 eq(js(p,'return OneDayLiteThemes.ids'),['glass-day','paper','night','color-block','minimal'])
 material_before=p.locator('.day').first.evaluate('e=>getComputedStyle(e).backgroundImage+"|"+getComputedStyle(e).backgroundColor')
 click(p,'[data-act="settings"]');assert p.locator('#themeSelect').is_visible();p.select_option('#themeSelect','color-block');p.wait_for_timeout(120)
 after=p.locator('.month-grid').bounding_box();assert after
 assert abs(before['width']-after['width'])<1
 eq(p.locator('html').get_attribute('data-theme'),'color-block')
 assert p.locator('meta[name="theme-color"]').get_attribute('content')
 material_after=p.locator('.day').first.evaluate('e=>getComputedStyle(e).backgroundImage+"|"+getComputedStyle(e).backgroundColor');assert material_after!=material_before
 p.keyboard.press('Escape');wait(p)

@test('calendar-marker-settings-writes-personal-leave-label')
def _(p):
 ds=js(p,'return OneDayLite.C.localDay()')
 click(p,'[data-act="settings"]');p.fill('#calendarMarkDate',ds);p.select_option('#calendarMarkType','请假');p.fill('#calendarMarkTitle','年假');click(p,'#calendarMarkSave');p.wait_for_timeout(220)
 eq(js(p,f'return OneDayLite.store.data.cal.find(r=>OneDayLite.C.day(r["标记日期"])==="{ds}")?.["标记类型"]'),'请假')
 cell=p.locator(f'.day[data-date="{ds}"]');assert cell.is_visible();assert '年假' in cell.inner_text();assert 'leave' in (cell.get_attribute('data-marker-kind') or '')

@test('calendar-reflection-disabled-for-reduced-motion')
def _(p):
 p.emulate_media(reduced_motion='reduce');wait(p)
 eq(js(p,'return OneDayLiteThemes.triggerReflection(document.querySelector(".calendar-main"))'),False)
 assert p.locator('.calendar-main.reflection-sweep').count()==0

def run():
 selected=sys.argv[1:]
 if not selected and os.getenv("ONEDAY_ISOLATED_CHILD")!="1":
  isolated=[]
  for name in tests:
   env=dict(os.environ);env["ONEDAY_ISOLATED_CHILD"]="1"
   cp=subprocess.run([sys.executable,str(Path(__file__).resolve()),name],cwd=R,env=env)
   isolated.append({"name":name,"pass":cp.returncode==0,"error":"" if cp.returncode==0 else "isolated scenario failed; see console output"})
  (V/'experience.json').write_text(json.dumps(isolated,ensure_ascii=False,indent=2))
  print(sum(c['pass'] for c in isolated),'/',len(isolated),'passed',flush=True)
  sys.exit(0 if all(c['pass'] for c in isolated) else 1)
 chosen=[]
 for index,(name,fn) in enumerate(tests.items()):
  if os.getenv("ONEDAY_PART") is not None and index%2!=int(os.environ["ONEDAY_PART"]):continue
  if selected and not any(s==name or s in name for s in selected):continue
  chosen.append((name,fn))
 # Keep each high-interaction scenario in its own Chromium lifetime. Drag / media
 # emulation scenarios can leave browser-process state behind even after a context
 # closes; process isolation keeps the release command deterministic.
 chunk_size=1
 for offset in range(0,len(chosen),chunk_size):
  group=chosen[offset:offset+chunk_size]
  with sync_playwright() as pw:
   b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
   for name,fn in group:
    context=b.new_context(viewport={'width':1440,'height':960},timezone_id='Asia/Shanghai',accept_downloads=True)
    p=context.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_default_timeout(2200);p.set_default_navigation_timeout(2200)
    formal=name.startswith('formal-')
    if name.startswith('fresh-mobile'):p.set_viewport_size({'width':390,'height':844})
    p.set_content((FORMAL if formal else HTML).replace('<head>','<head>'+SHIM,1))
    if not formal:p.wait_for_function('window.OneDayLite?.store.state.loaded')
    wait(p)
    try:
     fn(p);assert not errors,errors;checks.append({'name':name,'pass':True});print('PASS',name,flush=True)
    except Exception as e:
     checks.append({'name':name,'pass':False,'error':str(e),'pageErrors':errors});print('FAIL',name,str(e)[:220],flush=True);p.screenshot(path=str(V/(name+'-failure.png')),full_page=True)
    p.close();context.close()
   b.close()
 suffix=('-part'+os.environ['ONEDAY_PART']) if os.getenv('ONEDAY_PART') is not None else ('-subset' if sys.argv[1:] else '')
 (V/('experience'+suffix+'.json')).write_text(json.dumps(checks,ensure_ascii=False,indent=2))
 print(sum(c['pass'] for c in checks),'/',len(checks),'passed')
 sys.exit(0 if all(c['pass'] for c in checks) else 1)
if __name__=='__main__':run()
