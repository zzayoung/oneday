const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../../src/lite/reports.js');
const C=require('../../src/lite/core.js');
const now=Date.parse('2026-10-28T04:00:00Z');
const task=(id,extra={})=>({_id:id,'任务标题':id,'任务状态':'收集（未开始）','创建时间':'2026-01-01T00:00:00Z','状态开始时间':'2026-01-01T00:00:00Z',...extra});
const log=(id,tid,start,end,extra={})=>({_id:id,'任务ID':tid,'状态':'进行中','开始时间':start,'结束时间':end,...extra});
const data=(tasks=[],logs=[],notes=[],links=[])=>({tasks,logs,notes,links});
const week=()=>R.periodRange('week','2026-10-27');

test('report ranges use Monday weeks and inclusive visible dates',()=>{
 const r=week();A.equal(r.start,'2026-10-26');A.equal(r.end,'2026-11-01');A.equal(r.endExclusive,'2026-11-02');
 A.equal(r.from,Date.parse('2026-10-26T00:00:00+08:00'));A.equal(r.to,Date.parse('2026-11-02T00:00:00+08:00'));
 A.equal(R.periodRange('week',r.previousAnchor).start,'2026-10-19');A.equal(R.periodRange('week',r.nextAnchor).start,'2026-11-02');
});
test('month quarter half-year and year boundaries preserve leap days and year rollover',()=>{
 const month=R.periodRange('month','2024-02-20');A.equal(month.end,'2024-02-29');
 const quarter=R.periodRange('quarter','2026-03-31');A.equal(quarter.start,'2026-01-01');A.equal(quarter.end,'2026-03-31');A.equal(R.periodRange('quarter',quarter.previousAnchor).start,'2025-10-01');
 const half=R.periodRange('half','2026-10-27');A.equal(half.start,'2026-07-01');A.equal(half.end,'2026-12-31');A.equal(R.periodRange('half',half.previousAnchor).start,'2026-01-01');
 const year=R.periodRange('year','2024-12-31');A.equal(year.start,'2024-01-01');A.equal(year.end,'2024-12-31');A.equal((year.to-year.from)/86400000,366);
});
test('custom range validates its boundary and includes the entire final day',()=>{
 const r=R.periodRange('custom','2026-10-27',{start:'2026-10-01',end:'2026-10-01'});A.equal(r.to-r.from,86400000);
 A.throws(()=>R.periodRange('custom','2026-10-27',{start:'2026-02-30',end:'2026-03-01'}),/日期/);
 A.throws(()=>R.periodRange('custom','2026-10-27',{start:'2026-10-03',end:'2026-10-01'}),/结束/);
});
test('completion uses the real status end in Beijing time, never the planned date',()=>{
 const rows=[task('inside',{'任务状态':'完成','状态结束时间':'2026-10-25T16:30:00Z'}),task('before',{'任务状态':'完成','状态结束时间':'2026-10-25T15:59:59Z','计划开始时间':'2026-10-27T09:00:00Z'}),task('planned',{'计划开始时间':'2026-10-27T10:00:00Z','计划截止时间':'2026-10-27T11:00:00Z'})];
 const r=R.buildReport(data(rows),week(),now);A.deepEqual(r.completed.map(x=>x.id),['inside']);A.equal(r.completed[0].completedDate,'2026-10-26');A.equal(r.taskCount,1);A.equal(r.uniqueMs,0);A.ok(r.pending.some(x=>x.id==='planned'));A.equal(r.unloggedCompleted,1);
});
test('missing completion date does not turn a planned task into an achievement',()=>{
 const row=task('undated',{'任务状态':'完成','状态开始时间':null,'计划截止时间':'2026-10-27T12:00:00Z'});
 const r=R.buildReport(data([row]),week(),now);A.equal(r.completed.length,0);A.equal(r.taskCount,0);
});
test('actual execution unions duplicate, parallel, parent and child intervals',()=>{
 const rows=[task('parent',{'任务状态':'暂停'}),task('child',{'父任务ID':'parent','任务状态':'完成'})];
 const logs=[log('a','parent','2026-10-26T01:00:00Z','2026-10-26T02:00:00Z'),log('a2','parent','2026-10-26T01:30:00Z','2026-10-26T02:30:00Z'),log('b','child','2026-10-26T02:00:00Z','2026-10-26T03:00:00Z'),log('pause','parent','2026-10-26T03:00:00Z','2026-10-26T05:00:00Z',{'状态':'暂停'})];
 const r=R.buildReport(data(rows,logs),week(),now);A.equal(r.uniqueMs,2*3600000);A.equal(r.totalMs,2.5*3600000);A.equal(r.overlapMs,.5*3600000);A.equal(r.activeDays,1);A.equal(r.taskCount,2);
});
test('daily actual time splits at Beijing midnight and clips the selected period',()=>{
 const range=R.periodRange('custom','2026-10-27',{start:'2026-10-26',end:'2026-10-27'});
 const r=R.buildReport(data([task('a',{'任务状态':'完成'})],[log('a','a','2026-10-25T15:30:00Z','2026-10-25T16:30:00Z'),log('b','a','2026-10-26T15:30:00Z','2026-10-26T16:30:00Z')]),range,now);
 A.deepEqual(r.trend.map(x=>x.ms),[3600000,1800000]);A.equal(r.uniqueMs,5400000);
});
test('a linked written record is activity without fabricated execution time',()=>{
 const notes=[{_id:'n','关联任务ID':'a','便签内容':'已发出材料，等待反馈。','便签分类':'记录','创建时间':'2026-10-27T01:00:00Z','更新时间':'2026-10-27T01:00:00Z'}, {_id:'old','便签内容':'旧记录本周补充','便签分类':'灵感','创建时间':'2026-10-01T01:00:00Z','更新时间':'2026-10-27T02:00:00Z'}];
 const r=R.buildReport(data([task('a')],[],notes),week(),now);A.equal(r.taskCount,1);A.equal(r.uniqueMs,0);A.equal(r.notes.length,2);A.equal(r.notes.find(x=>x.id==='old').updated,true);A.equal(r.categories.find(x=>x.name==='灵感').count,1);A.equal(r.activeDays,1);
});
test('historical deleted work is retained and labeled, deleted backlog is not a next step',()=>{
 const rows=[task('deleted',{'任务状态':'完成','状态结束时间':'2026-10-26T03:00:00Z','回收站':true,'删除时间':'2026-10-27T01:00:00Z'}),task('backlog',{'回收站':true,'计划开始时间':'2026-11-02T10:00:00Z'})];
 const r=R.buildReport(data(rows,[log('work','deleted','2026-10-26T01:00:00Z','2026-10-26T02:00:00Z')]),week(),now);A.equal(r.uniqueMs,3600000);A.equal(r.completed[0].trashed,true);A.equal(r.upcoming.length,0);A.match(R.reportMarkdown(r),/已移入回收站/);
});
test('a legacy running trash row stops contributing at its deletion time',()=>{
 const row=task('deleted',{'任务状态':'进行中','状态开始时间':'2026-10-26T01:00:00Z','回收站':true,'删除时间':'2026-10-26T02:00:00Z'});
 const r=R.buildReport(data([row]),week(),now);A.equal(r.uniqueMs,3600000);A.equal(r.progress.length,0);
});
test('tags can overlap but overall execution is still a unique time union',()=>{
 const links=[{'任务ID':'a','标签名称':'工作'},{'任务ID':'a','标签名称':'重点'},{'任务ID':'a','标签名称':'工作'}];
 const r=R.buildReport(data([task('a')],[log('l','a','2026-10-26T01:00:00Z','2026-10-26T02:00:00Z')],[],links),week(),now);
 A.equal(r.tags.find(x=>x.name==='工作').ms,3600000);A.equal(r.tags.find(x=>x.name==='重点').count,1);A.equal(r.uniqueMs,3600000);
});
test('future schedules and future running starts never count as recorded work',()=>{
 const row=task('future',{'任务状态':'进行中','状态开始时间':'2026-11-01T02:00:00Z','计划开始时间':'2026-11-01T09:00:00Z','计划截止时间':'2026-11-01T10:00:00Z'});
 const r=R.buildReport(data([row]),week(),now);A.equal(r.uniqueMs,0);A.equal(r.taskCount,0);A.equal(r.activeDays,0);
});
test('report draft states its evidence and separates planned next steps',()=>{
 const rows=[task('交付方案',{'任务状态':'完成','状态结束时间':'2026-10-26T03:00:00Z'}),task('计划沟通',{'计划开始时间':'2026-11-02T09:00:00Z','计划截止时间':'2026-11-02T10:00:00Z'})];
 const r=R.buildReport(data(rows),week(),now),md=R.reportMarkdown(r);A.match(md,/交付方案/);A.match(md,/计划沟通/);A.match(md,/未记录执行时长/);A.match(md,/下一步.*已有安排/);A.match(md,/北京时间/);A.doesNotMatch(md,/显著提升|节省成本|超额完成/);
});
test('empty report does not invent completed work or productivity',()=>{
 const r=R.buildReport(data(),week(),now),md=R.reportMarkdown(r);A.equal(r.hasActivity,false);A.equal(r.completedCount,0);A.match(md,/没有可确认的完成记录/);A.match(md,/没有记录到执行时段/);
});
test('edited per-range report draft survives store repaint and switching away and back',()=>{
 const saved=new Map(),L={C,store:{data:data()},UI:{},read:(k,f)=>saved.has(k)?saved.get(k):f,save:(k,v)=>saved.set(k,v),icon:()=>''};
 R.attach(L);L.UI.report.anchor='2026-10-27';const initial=L.renderReports();A.match(initial,/工作回顾/);
 const key='report.draft.2026-10-26.2026-11-01';L.UI.report.drafts.set(key,'我的周报草稿');L.store.data.tasks.push(task('new',{'创建时间':'2026-10-27T01:00:00Z'}));A.match(L.renderReports(),/我的周报草稿/);
 L.UI.report.anchor='2026-10-20';A.doesNotMatch(L.renderReports(),/我的周报草稿/);L.UI.report.anchor='2026-10-27';A.match(L.renderReports(),/我的周报草稿/);
});
test('draft input keeps edits and reports a local-storage failure accurately',()=>{
 const L={C,store:{data:data()},UI:{},read:(k,f)=>f,save:()=>false,icon:()=>''},handlers=new Map(),textarea={value:'需要保留的周报'},status={textContent:''};
 R.attach(L);L.UI.report.anchor='2026-10-27';L.renderReports();
 L.mountReports({querySelector:selector=>selector==='[data-report-draft]'?textarea:status,addEventListener:(type,handler)=>handlers.set(type,handler)});
 handlers.get('input')({target:textarea});A.equal(L.UI.report.drafts.get(L.UI.report.key),textarea.value);A.match(status.textContent,/暂留在当前页面/);A.match(L.renderReports(),/需要保留的周报/);
});
test('work done in a past period remains visible when completion happened later',()=>{
 const row=task('跨周方案',{'任务状态':'完成','状态结束时间':'2026-11-03T03:00:00Z','状态开始时间':'2026-11-03T03:00:00Z'});
 const r=R.buildReport(data([row],[log('work','跨周方案','2026-10-26T01:00:00Z','2026-10-26T02:00:00Z')]),week(),Date.parse('2026-11-04T04:00:00Z'));
 A.equal(r.completedCount,0);A.equal(r.otherActivity[0].id,'跨周方案');A.match(R.reportMarkdown(r),/跨周方案/);A.match(R.reportMarkdown(r),/完成时间不在本期/);
});

function mountedReport({preview=false,clipboard,execCopy=false}={}){
 const handlers=new Map(),saved=new Map(),downloads=[],notices=[],draft='## 我的周报\n\n- 已核对交付材料\n- 下一步：等待反馈',status={textContent:''},previewNode={hidden:!preview},toggle={textContent:preview?'编辑':'预览',setAttribute(name,value){this[name]=value;}};
 const document={activeElement:null,execCommand(action){A.equal(action,'copy');return execCopy;}},textarea={value:draft,hidden:preview,selectionStart:0,selectionEnd:0,scrollTop:0,focus(){document.activeElement=this;},select(){this.selectionStart=0;this.selectionEnd=this.value.length;},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
 const container={querySelector(selector){return {'[data-report-draft]':textarea,'[data-report-draft-status]':status,'.report-preview':previewNode,'[data-report-action="preview"]':toggle}[selector]||null;},addEventListener:(type,fn)=>handlers.set(type,fn),removeEventListener:(type,fn)=>{if(handlers.get(type)===fn)handlers.delete(type);}};
 const L={C,store:{data:data()},UI:{},read:(key,fallback)=>saved.has(key)?saved.get(key):fallback,save:(key,value)=>{saved.set(key,value);return true;},remove:key=>saved.delete(key),icon:()=>'<svg><path/></svg>',download:(...args)=>downloads.push(args),toast:message=>notices.push(message)};
 const context={OneDayLiteCore:C,OneDayLite:L,navigator:{clipboard},document};context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../src/lite/reports.js'),'utf8'),context,{filename:'reports.js'});
 L.UI.report.anchor='2026-10-27';L.UI.report.preview=preview;L.renderReports();L.UI.report.drafts.set(L.UI.report.key,draft);A.ok(L.renderReports().includes(C.esc(draft)));const controller=L.mountReports(container);
 return{L,textarea,document,previewNode,toggle,downloads,notices,draft,controller,async click(action,nested=false){const button={dataset:{reportAction:action},closest(selector){return selector.includes('[data-report-action]')?this:null;}},target=nested?{tagName:'path',closest:selector=>button.closest(selector)}:button;let prevented=false;await handlers.get('click')({target,preventDefault(){prevented=true;}});A.equal(prevented,true);}};
}
test('report export uses the edited Markdown from button and SVG child clicks, including preview mode',async()=>{
 for(const preview of [false,true]){const x=mountedReport({preview});await x.click('export',preview);A.equal(x.downloads.length,1);A.deepEqual(x.downloads[0],['OneDay-周报-2026-10-26_2026-11-01.md',x.draft,'text/markdown;charset=utf-8']);A.match(x.notices[0],/已导出.*Markdown/);x.controller.destroy();}
});
test('report copy writes the edited Markdown and confirms success from an SVG child click',async()=>{
 const copied=[],x=mountedReport({preview:true,clipboard:{writeText:async value=>copied.push(value)}});await x.click('copy',true);A.deepEqual(copied,[x.draft]);A.match(x.notices[0],/已复制/);A.equal(x.document.activeElement,null);x.controller.destroy();
});
test('a denied report clipboard request reveals and selects the complete draft with a usable fallback',async()=>{
 for(const execCopy of [false,true]){const x=mountedReport({preview:true,clipboard:{writeText:async()=>{throw Error('NotAllowedError');}},execCopy});await x.click('copy');A.equal(x.L.UI.report.preview,false);A.equal(x.textarea.hidden,false);A.equal(x.previewNode.hidden,true);A.equal(x.document.activeElement,x.textarea);A.equal(x.textarea.selectionStart,0);A.equal(x.textarea.selectionEnd,x.draft.length);A.equal(x.toggle['aria-pressed'],'false');A.match(x.notices[0],execCopy?/已复制/:/已选中草稿/);x.controller.destroy();}
});
test('restoring the stats view waits for loaded data before mounting report interactions',()=>{
 const view={innerHTML:'',scrollTop:0,querySelector:()=>null,querySelectorAll:()=>[],classList:{toggle(){}}};let mounted=0,rendered=0;
 const L={C,UI:{tab:'tasks',view:'stats'},$:id=>id==='mainView'?view:null,icon:()=>'',store:{state:{loaded:false,connected:true,readError:''}},renderReports(){rendered++;return '<section>工作回顾</section>';},mountReports(container){A.equal(container,view);A.match(view.innerHTML,/工作回顾/);mounted++;return{destroy(){}};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../src/lite/views.js'),'utf8'),{window:{OneDayLite:L}},{filename:'views.js'});
 L.paintSync=()=>{};L.paintHeader=()=>{};L.paintTimes=()=>{};
 L.render();A.match(view.innerHTML,/loading-state/);A.equal(rendered,0);A.equal(mounted,0);
 L.store.state.loaded=true;L.render();A.equal(rendered,1);A.equal(mounted,1);
});
