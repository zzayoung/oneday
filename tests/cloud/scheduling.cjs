'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../../src/lite/core.js');
const Store=require('../../src/lite/store.js');
const Cloud=require('../../src/lite/cloud.js');
const ROOT=path.resolve(__dirname,'../..'),DAY='2026-10-19';
const clone=value=>JSON.parse(JSON.stringify(value));
const task=(id,start,end,extra={})=>({_id:id,_version:1,'任务标题':id,'任务类型':'主任务','任务状态':C.STATUS[0],'任务详情':'正文 '+id,'计划开始时间':DAY+'T'+start+':00Z','计划截止时间':DAY+'T'+end+':00Z',...extra});
const props=(start,end)=>({'计划开始时间':{date:DAY+'T'+start+':00Z'},'计划截止时间':{date:DAY+'T'+end+':00Z'}});

// The production store runs against a versioned, in-memory transport. Only the
// presentation boundary is replaced: every observed write is a real store call.
async function setup(initial=[],parallel=true){
 const rows=Object.fromEntries(Object.keys(Store.IDS).map(key=>[key,[]]));rows.tasks=clone(initial);
 const writes=[],adds=[],messages=[],drafts=new Map();let reads=0,nextId=0;
 const table=id=>Object.keys(Store.IDS).find(key=>Store.IDS[key]===id);
 const db={kind:'sites',taskFields:parallel?['允许并行','最后期限','预计时长']:[],
  async query(p){if(table(p.databaseId)==='tasks')reads++;return {results:clone(rows[table(p.databaseId)]),hasMore:false};},
  async getRecord(p){return clone(rows[table(p.databaseId)].find(row=>row._id===p.recordId)||null);},
  async updateRecord(p){const row=rows[table(p.databaseId)].find(row=>row._id===p.recordId);if(row._version!==p.expectedVersion)throw Error('版本冲突');writes.push(clone(p));for(const[k,v]of Object.entries(p.properties))row[k]=C.value(v);row._version++;return clone(row);},
  async addRecord(p){adds.push(clone(p));const row={_id:'new-'+(++nextId),_version:1};for(const[k,v]of Object.entries(p.properties))row[k]=C.value(v);rows[table(p.databaseId)].push(row);return clone(row);}
 };
 const store=Store.createStore(db);await store.read();reads=0;
 const context={console,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},document:{activeElement:null,addEventListener(){},removeEventListener(){}}};context.window=context;vm.createContext(context);
 for(const file of ['src/core.js','src/lite/core.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 const L=context.OneDayLite={C:context.OneDayLiteCore,UI:{date:DAY,tab:'tasks'},store,icon:()=>'',
  find:id=>store.get('tasks',id),tasks:()=>store.data.tasks.filter(row=>!row['回收站']),body:row=>row['任务详情']||'',sort:rows=>rows,notes:()=>[],tags:()=>[],
  time:id=>C.taskTime(store.get('tasks',id),[]),planText:row=>row['计划开始时间']||'未安排',statusLabel:value=>value,statusClass:()=>'',cardActions:()=>'',dateText:value=>value,
  read:(key,fallback=null)=>drafts.has(key)?clone(drafts.get(key)):fallback,save:(key,value)=>{drafts.set(key,clone(value));return true;},remove:key=>drafts.delete(key),registerDraftSource:()=>()=>{},
  toast:message=>messages.push(message),run:async fn=>fn(),capturingDrafts:false,draftStorageAvailable:true
 };
 for(const file of ['src/lite/dialogs.js','src/lite/gestures.js','src/lite/timeline.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 return {L,context,rows,writes,adds,messages,drafts,get reads(){return reads;}};
}

async function cloudSetup(initial=[]){
 const x=await setup(initial),requests=[],receipts=new Map(),disk=new Map();let lost=2,sequence=0;
 const fetch=async(url,options={})=>{
  const route=new URL(url,'https://oneday.test').pathname.replace('/api/oneday',''),parts=route.split('/').filter(Boolean);
  const response=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
  if(parts[0]==='revision')return response({revision:String(x.rows.tasks.length)});
  if(parts[0]==='records'&&(!options.method||options.method==='GET'))return response(parts[2]?{record:clone(x.rows[parts[1]].find(row=>row._id===parts[2]))}:{results:clone(x.rows[parts[1]]),hasMore:false});
  if(parts[0]==='records'&&options.method==='POST'){
   const body=JSON.parse(options.body);requests.push(clone(body));let record=receipts.get(body.requestId);
   if(!record){record={_id:body.recordId,_version:1};for(const[key,value]of Object.entries(body.properties))record[key]=C.value(value);x.rows[parts[1]].push(record);receipts.set(body.requestId,clone(record));}
   if(lost-->0)throw new TypeError('response was lost');return response({record});
  }
  throw Error('Unexpected test route '+route);
 };
 const connect=async()=>{
  const previous=global.window;global.window={__ONEDAY_SCOPE__:'schedule-retry-test',localStorage:{getItem:key=>disk.get(key)||null,setItem:(key,value)=>disk.set(key,value)}};
  let db;try{db=Cloud.createDatabase({fetch,uuid:()=> 'request-'+(++sequence)});}finally{if(previous===undefined)delete global.window;else global.window=previous;}
  const store=Store.createStore(db);await store.read();x.L.store=store;x.L.find=id=>store.get('tasks',id);x.L.tasks=()=>store.data.tasks.filter(row=>!row['回收站']);return store;
 };
 await connect();return {...x,requests,reconnect:connect};
}

function dialogHost(x){
 const fields=new Map(),events=new Map(),editors=[];let options;
 const node=()=>({value:'',checked:false,dataset:{},hidden:false,innerHTML:'',classList:{add(){},remove(){}},addEventListener(){},setAttribute(){},querySelectorAll:()=>[],contains:()=>true});
 const api={root:node(),element:node(),closed:false,q:selector=>{if(!fields.has(selector))fields.set(selector,node());return fields.get(selector);},qa:()=>[],on:(selector,event,fn)=>events.set(selector+':'+event,fn),error(){},async close(force){if(force||!options.onClose||await options.onClose()!==false)this.closed=true;return this.closed;}};
 api.element.addEventListener=(type,fn)=>events.set('element:'+type,fn);
 x.L.dialog=value=>{options=value;value.onMount?.(api);return api;};
 x.context.OneDayLiteEditor={mount(_root,value){const editor={value:value.value,getValue(){return this.value;},flush(){},whenReady:async()=>{},destroy(){},focus(){}};editors.push(editor);return editor;}};
 return {api,events,editors};
}

function dayHost(x,id){
 const listeners=new Map(),frames=new Map(),runs=[],classes={add(){},remove(){}};let html='',frame=0,drafts,gesture;
 const root={get innerHTML(){return html;},set innerHTML(value){html=value;},querySelector:()=>null,querySelectorAll:()=>[]};
 const header={append(){}},element={classList:classes,append(){},addEventListener:(type,fn)=>listeners.set(type,fn)},api={root:{classList:classes},element,q:selector=>selector==='.dialog-header'?header:root,qa:()=>[]};
 x.context.document.createElement=()=>({className:'',innerHTML:'',textContent:'',style:{},setAttribute(){},remove(){},getBoundingClientRect:()=>({width:160,height:32})});
 x.context.innerWidth=390;x.context.innerHeight=740;
 x.context.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};x.context.cancelAnimationFrame=id=>frames.delete(id);
 // The gesture engine has dedicated pointer integration tests. Capture the Day
 // callbacks here to exercise its real schedule conflict presenter and drafts.
 x.context.OneDayLiteGestures={bind:()=>({active:false,start(_event,options){gesture=options;return true;},cancel(){},destroy(){}})};
 const create=x.L.createDayDrafts;x.L.createDayDrafts=(...args)=>{drafts=create(...args);return drafts;};
 x.L.dialog=value=>{value.onMount(api);return api;};x.L.run=fn=>{const operation=Promise.resolve().then(fn);runs.push(operation);return operation;};
 x.L.openDayTimeline(DAY,id);
 const emit=(type,selector,dataset)=>{const target={dataset,closest:query=>query===selector?target:null};return listeners.get(type)?.({target,preventDefault(){}});};
 const paint=()=>{for(const [key,fn]of [...frames]){frames.delete(key);fn();}};paint();
 const resizeEnd=delta=>{
  const row=x.L.find(id),start=C.planMinute(row['计划开始时间']),end=C.planMinute(row['计划截止时间']),label={textContent:''},scroll={scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:900})};
  const card={dataset:{taskId:id,start:String(start),end:String(end)},style:{top:'0px',height:'48px'},classList:classes,querySelector:()=>label,closest:selector=>selector==='.day-timeline-scroll'?scroll:null,getBoundingClientRect:()=>({left:80,top:400,width:180,height:48})};
  const edge={dataset:{resize:'end'},closest:selector=>selector==='.day-task-card'?card:selector==='[data-resize]'?edge:null};
  listeners.get('pointerdown')({target:edge,pointerId:1,pointerType:'mouse',button:0,isPrimary:true,clientX:100,clientY:400,preventDefault(){}});
  const point={x:100,y:400+delta,dx:0,dy:delta,dragging:true};gesture.onMove(point);gesture.onCommit(point);gesture.onEnd(point);
 };
 return {root,runs,get drafts(){return drafts;},emit,paint,resizeEnd};
}

// Run the real composition root; presentation and browser events are the boundary.
async function appHost(x){
 const listeners=new Map(),elements=new Map();
 x.L.UI.captureKind='task';x.L.UI.parsed=false;x.L.modalStack=[];x.L.detail=null;
 x.L.$=name=>{if(!elements.has(name))elements.set(name,{value:'',dataset:{},addEventListener(){},focus(){}});return elements.get(name);};
 x.L.autosize=()=>{};x.L.paintSync=()=>{};x.L.render=()=>{};x.L.scheduleRender=()=>{};x.L.debounce=(_key,fn)=>fn();
 x.context.document.addEventListener=(name,fn)=>listeners.set(name,fn);x.context.document.querySelectorAll=()=>[];x.context.addEventListener=()=>{};x.context.setInterval=()=>1;
 x.context.__SMART_PAGE__={database:{}};x.context.OneDayLiteStore={createStore:()=>x.L.store};
 vm.runInContext(fs.readFileSync(path.join(ROOT,'src/lite/app.js'),'utf8'),x.context,{filename:'src/lite/app.js'});await new Promise(setImmediate);
 return {listeners,key(key,extra={}){const event={key,target:{matches:()=>false,isContentEditable:false},preventDefault(){this.defaultPrevented=true;},...extra};listeners.get('keydown')(event);return event;}};
}

test('precise conflict detection does not snap a typed interval past an occupied minute',()=>{
 const result=C.timelinePlan([task('busy','10:07','10:13')],DAY,'new',610,620);
 A.equal(result.conflicts.length,1);
 A.equal(result.next.end-result.next.start,10);
});

test('child schedule conflicts use siblings and exclude their enclosing parent',()=>{
 const rows=[task('parent','09:00','12:00'),task('child','09:00','10:00',{'父任务ID':'parent','任务类型':'子任务'}),task('sibling','10:00','11:00',{'父任务ID':'parent','任务类型':'子任务'}),task('other-child','10:00','11:00',{'父任务ID':'other','任务类型':'子任务'})];
 A.deepEqual(C.timelineConflicts(rows,DAY,'child',615,645).map(row=>row.id),['sibling']);
});

test('schedule validation rejects reversed and zero intervals, including explicit cross-day dates',()=>{
 A.equal(typeof C.schedulePlan,'function');
 for(const candidate of [task('new','10:00','10:00'),task('new','11:00','10:00'),task('new','10:00','11:00',{'计划开始时间':'2026-10-20T10:00:00Z'})])A.throws(()=>C.schedulePlan([],candidate),/结束|截止/);
});

test('all-day and valid cross-day records retain their legacy parking semantics',()=>{
 A.equal(typeof C.schedulePlan,'function');const busy=task('busy','09:00','18:00');
 for(const candidate of [task('all','00:00','23:59'),task('span','23:00','01:00',{'计划截止时间':'2026-10-20T01:00:00Z'})]){
  const result=C.schedulePlan([busy],candidate);A.equal(result.conflicts.length,0);A.equal(result.next,null);
 }
});

test('an offered gap preserves a legacy duration shorter than one minute',()=>{
 const candidate=task('short','10:07','10:07',{'计划开始时间':DAY+'T10:07:30Z','计划截止时间':DAY+'T10:07:50Z'}),plan=C.schedulePlan([task('busy','10:00','11:00')],candidate);
 A.ok(plan.next);const a=plan.next.props['计划开始时间'].date,b=plan.next.props['计划截止时间'].date;
 A.equal(Date.parse(b)-Date.parse(a),20000);A.equal(a,DAY+'T11:00:00Z');A.equal(b,DAY+'T11:00:20Z');
});

test('canceling a conflicting creation performs no writes and shows the overlapping title',async()=>{
 const x=await setup([task('方案评审','10:00','11:00')]);A.equal(typeof x.L.createScheduledTask,'function');let shown;
 const result=await x.L.createScheduledTask({title:'写方案',date:DAY,start:'10:10',end:'10:20'},{present:async plan=>{shown=plan;return 'cancel';}});
 A.equal(result,null);A.equal(x.adds.length,0);A.equal(x.writes.length,0);A.equal(x.reads,0);
 A.match(x.L.scheduleConflictHTML(shown),/方案评审/);A.match(x.L.scheduleConflictHTML(shown),/11:00.*11:10/);
});

test('nonconflicting creation preserves exact typed minutes without showing a prompt',async()=>{
 const x=await setup();A.equal(typeof x.L.createScheduledTask,'function');let shown=0;
 const saved=await x.L.createScheduledTask({title:'精确安排',date:DAY,start:'10:10',end:'10:20'},{present:async()=>{shown++;return 'cancel';}});
 A.equal(saved['计划开始时间'],DAY+'T10:10:00Z');A.equal(saved['计划截止时间'],DAY+'T10:20:00Z');A.equal(shown,0);A.equal(x.adds.length,1);
});

test('explicit parallel acceptance creates one task with both its schedule and permission',async()=>{
 const busy=task('已有安排','10:00','11:00'),x=await setup([busy]);A.equal(typeof x.L.createScheduledTask,'function');
 const saved=await x.L.createScheduledTask({title:'并行安排',date:DAY,start:'10:10',end:'10:20'},{present:async()=> 'parallel'});
 A.equal(saved['允许并行'],true);A.equal(saved['计划开始时间'],DAY+'T10:10:00Z');A.equal(x.adds.length,1);A.equal(x.writes.length,0);A.deepEqual(x.rows.tasks[0],busy);
});

test('a stale available slot is shown again instead of silently choosing another slot',async()=>{
 const x=await setup([task('busy','10:00','11:00')]);A.equal(typeof x.L.createScheduledTask,'function');const previews=[];
 const result=await x.L.createScheduledTask({title:'待安排',date:DAY,start:'10:00',end:'10:30'},{present:async plan=>{
  previews.push(clone(plan));if(previews.length===1){x.rows.tasks.push(task('刚加入的安排','11:00','12:00'));return 'next';}return 'cancel';
 }});
 A.equal(result,null);A.equal(previews.length,2);A.ok(previews[1].conflicts.some(row=>row.task['任务标题']==='刚加入的安排'));A.equal(x.adds.length,0);A.equal(x.reads,1);
});

test('a changed schedule on the same task cannot replace the captured conflict base',async()=>{
 const base=task('moving','08:00','09:00'),x=await setup([base,task('busy','10:00','11:00')]);A.equal(typeof x.L.saveTaskSchedule,'function');
 await A.rejects(x.L.saveTaskSchedule('moving',props('10:00','10:30'),base,{present:async()=>{x.rows.tasks[0]['计划开始时间']=DAY+'T07:00:00Z';x.rows.tasks[0]._version++;return 'parallel';}}),/其他设备|重新读取|修改/);
 A.equal(x.writes.length,0);A.equal(x.rows.tasks[0]['计划开始时间'],DAY+'T07:00:00Z');
});

test('the final authoritative patch read rejects a changed parent after schedule review',async()=>{
 const base=task('moving','08:00','09:00',{'父任务ID':'parent-a','任务类型':'子任务'}),x=await setup([base,task('new-sibling','10:00','11:00',{'父任务ID':'parent-b','任务类型':'子任务'})]),patch=x.L.store.patch;
 x.L.store.patch=(...args)=>{x.rows.tasks[0]['父任务ID']='parent-b';x.rows.tasks[0]._version++;return patch(...args);};
 await A.rejects(x.L.saveTaskSchedule('moving',props('10:00','10:30'),base,{present:async()=> 'cancel'}),/其他设备|修改/);A.equal(x.writes.length,0);
});

test('parallel choice is unavailable when the connected schema cannot persist it',async()=>{
 const x=await setup([task('busy','10:00','11:00')],false);A.equal(typeof x.L.createScheduledTask,'function');let html='';
 await A.rejects(x.L.createScheduledTask({title:'待安排',date:DAY,start:'10:00',end:'10:30'},{present:async plan=>{html=x.L.scheduleConflictHTML(plan);return 'parallel';}}),/并行/);
 A.doesNotMatch(html,/data-conflict-action="parallel"/);A.equal(x.adds.length,0);
});

test('the creation sheet retains the entire draft when its schedule conflict is canceled',async()=>{
 const x=await setup([task('busy','10:00','11:00')]),host=dialogHost(x);let shown=0;
 x.L.createSchedulePrompt=()=>({present:async()=>{shown++;return 'cancel';},cancel(){},clear(){}});
 x.L.openCreationSheet({date:DAY,start:'10:10'});host.api.q('#newTaskDuration').value='10';host.editors[0].value='创建草稿\n不能丢掉的正文';
 await host.events.get('#newTaskSave:click')();
 A.equal(shown,1);A.equal(x.adds.length,0);A.equal(host.api.closed,false);A.equal(x.drafts.get('newrecord.root').category,'待办');A.equal(x.drafts.get('newrecord.root').body,'创建草稿\n不能丢掉的正文');
});

test('changing a conflicted capture category cancels scheduling and saves its one document',async()=>{
 const x=await setup([task('busy','10:00','11:00')]),host=dialogHost(x);let choose;
 x.L.createSchedulePrompt=()=>({present:()=>new Promise(resolve=>choose=resolve),cancel(){if(choose){const resolve=choose;choose=null;resolve('cancel');}},clear(){}});
 x.L.openCreationSheet({date:DAY,start:'10:10'});host.api.q('#newTaskDuration').value='10';host.editors[0].value='保存同一条记录';
 const pending=host.events.get('#newTaskSave:click')();await new Promise(setImmediate);
 const categoryButton={dataset:{recordCategory:'1'},disabled:false};host.events.get('element:click')({target:{closest:selector=>selector==='[data-record-category]'?categoryButton:null}});await pending;
 A.equal(choose,null);await host.events.get('#newTaskSave:click')();A.equal(x.rows.tasks.length,1);A.equal(x.rows.notes.length,1);A.equal(x.rows.notes[0]['便签内容'],'保存同一条记录');A.equal(x.rows.notes[0]['便签分类'],'灵感');A.equal(x.drafts.has('newrecord.root'),false);
});

for(const choice of ['none','next','parallel'])test('unconfirmed task creation replays the exact payload after '+choice+' resolution and reload',async()=>{
 const x=await cloudSetup(choice==='none'?[]:[task('busy','10:00','11:00')]),input={title:'只创建一条',body:'保持原始正文',date:DAY,start:'10:10',end:'10:20'};let retryPrompts=0;
 await A.rejects(x.L.createScheduledTask(input,{present:async()=>choice}),/尚未确认|无法连接/);await x.reconnect();
 const saved=await x.L.createScheduledTask(input,{present:async()=>{retryPrompts++;return choice==='none'?'parallel':choice;}});
 A.equal(retryPrompts,0);A.equal(x.rows.tasks.length,choice==='none'?1:2);A.deepEqual(x.requests[2],x.requests[0]);A.deepEqual(Object.keys(x.requests[0]).sort(),['properties','recordId','requestId']);A.equal(saved._id,x.requests[0].recordId);
 if(choice==='next')A.equal(saved['计划开始时间'],DAY+'T11:00:00Z');if(choice==='parallel')A.equal(saved['允许并行'],true);
});

test('the task plan dialog restores canceled controls without persisting the candidate',async()=>{
 const base=task('moving','08:00','09:00'),x=await setup([base,task('busy','10:00','11:00')]),host=dialogHost(x);let shown=0;
 x.L.createSchedulePrompt=()=>({present:async()=>{shown++;return 'cancel';},cancel(){},clear(){}});
 x.L.openPlan('moving');host.api.q('#preciseTime').checked=true;host.api.q('#planStart').value=DAY+'T10:10';host.api.q('#planEnd').value=DAY+'T10:20';
 await host.events.get('#savePlan:click')({currentTarget:host.api.q('#savePlan')});
 A.equal(shown,1);A.equal(x.writes.length,0);A.equal(host.api.closed,false);A.equal(host.api.q('#planStart').value,DAY+'T08:00');A.equal(host.api.q('#planEnd').value,DAY+'T09:00');
});

test('promoting a timed child previews main-track conflicts and preserves its parent on cancel',async()=>{
 const child=task('child','10:10','10:20',{'父任务ID':'parent','任务类型':'子任务'}),x=await setup([task('parent','08:00','09:00'),child,task('busy','10:00','11:00')]),host=dialogHost(x);let shown=0;
 x.L.createSchedulePrompt=()=>({present:async()=>{shown++;return 'cancel';},cancel(){},clear(){}});x.L.pickParent('child');host.api.q('#parentChoice').value='';
 await host.events.get('#parentSave:click')({currentTarget:host.api.q('#parentSave')});A.equal(shown,1);A.equal(x.writes.length,0);A.equal(x.rows.tasks[1]['父任务ID'],'parent');A.equal(host.api.closed,false);
});

test('Day resize conflicts restore the original schedule and retain the complete content draft',async()=>{
 const x=await setup([task('moving','08:00','09:00'),task('方案评审','10:00','11:00')]),host=dayHost(x,'moving');
 host.drafts.changeBody('moving','未提交标题\n未提交正文');
 host.resizeEnd(96);await new Promise(setImmediate);
 A.match(host.root.innerHTML,/data-timeline-conflict/);A.match(host.root.innerHTML,/方案评审/);A.equal(x.writes.length,0);
 host.emit('click','[data-conflict-action]',{conflictAction:'cancel'});await Promise.all(host.runs);host.paint();
 A.equal(x.L.find('moving')['计划开始时间'],DAY+'T08:00:00Z');A.equal(x.L.find('moving')['计划截止时间'],DAY+'T09:00:00Z');A.equal(x.writes.length,0);
 A.equal(host.drafts.session('moving').values['任务标题'],'未提交标题');A.equal(host.drafts.session('moving').values['任务详情'],'未提交标题\n未提交正文');
});

test('calendar date drag uses the same preview and leaves the task in place on cancel',async()=>{
 const targetDay='2026-10-20',moving=task('moving','08:00','09:00'),x=await setup([moving,task('busy','08:00','09:00',{'计划开始时间':targetDay+'T08:00:00Z','计划截止时间':targetDay+'T09:00:00Z'})]);
 const runs=[];let shown=0;
 x.L.showScheduleConflict=async()=>{shown++;return 'cancel';};x.L.run=fn=>{const operation=Promise.resolve().then(fn);runs.push(operation);return operation;};
 const {listeners}=await appHost(x);
 const card={dataset:{dragId:'moving'},classList:{add(){}},closest:()=>card},drop={dataset:{dropDay:targetDay},closest:()=>drop};
 listeners.get('dragstart')({target:card,dataTransfer:{setData(){}}});listeners.get('drop')({target:drop,preventDefault(){}});await Promise.all(runs);
 A.equal(shown,1);A.equal(x.writes.length,0);A.deepEqual(x.rows.tasks[0],moving);
});

for(const key of ['/','+'])test(key+' opens a creation sheet above Day and leaves Day mounted',async()=>{
 const x=await setup(),host=await appHost(x),created={root:{}};let opened=0;
 const day={root:{},createRecord(){opened++;x.L.modalStack.push(created);}};x.L.modalStack.push(day);
 const event=host.key(key);A.equal(event.defaultPrevented,true);A.equal(opened,1);A.equal(x.L.modalStack[0],day);A.equal(x.L.modalStack.at(-1),created);
 host.key(key);A.equal(opened,1,'the nested creation sheet must block further shortcuts');
});

test('+ creates from the main page and global-create routes through the top Day dialog',async()=>{
 const x=await setup(),host=await appHost(x),requests=[];x.L.openCreationSheet=()=>requests.push('main');
 A.equal(host.key('+').defaultPrevented,true);A.deepEqual(requests,['main']);
 x.L.modalStack.push({root:{},createRecord:()=>requests.push('day')});x.L.actions['global-create']();A.deepEqual(requests,['main','day']);
});

test('creation shortcuts leave typing, IME, modifiers and repeated keydown untouched',async()=>{
 const x=await setup(),host=await appHost(x);let opened=0;
 x.L.modalStack.push({root:{},createRecord:()=>opened++});
 const scenarios=[{target:{matches:()=>true}},{target:{matches:()=>false,isContentEditable:true}},{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{repeat:true}];
 for(const key of ['/','+'])for(const extra of scenarios)A.notEqual(host.key(key,extra).defaultPrevented,true);
 A.equal(opened,0);
});

test('creation shortcuts cannot reach an underlying Day or task detail',async()=>{
 const x=await setup(),host=await appHost(x);let opened=0;x.L.openCreationSheet=()=>opened++;
 x.L.modalStack.push({root:{},createRecord:()=>opened++},{root:{}});
 for(const key of ['/','+'])host.key(key);x.L.actions['global-create']();
 x.L.modalStack=[];x.L.detail={element:{}};for(const key of ['/','+'])host.key(key);x.L.actions['global-create']();
 A.equal(opened,0);
});
