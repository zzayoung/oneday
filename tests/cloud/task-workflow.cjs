'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../../src/lite/core.js');
const Store=require('../../src/lite/store.js');
const ROOT=path.resolve(__dirname,'../..'),DAY='2026-10-27';
const clone=value=>JSON.parse(JSON.stringify(value));

async function setup(initial=[]){
 const rows=Object.fromEntries(Object.keys(Store.IDS).map(key=>[key,[]]));rows.tasks=clone(initial);
 const writes=[],notices=[],drafts=new Map(),dialogs=[],editors=[],events=new Map(),fields=new Map();let seq=0,confirm=true;
 const table=id=>Object.keys(Store.IDS).find(key=>Store.IDS[key]===id);
 const db={kind:'sites',taskFields:['预计时长','允许并行','最后期限'],
  async query(p){return {results:clone(rows[table(p.databaseId)]),hasMore:false};},
  async getRecord(p){return clone(rows[table(p.databaseId)].find(row=>row._id===p.recordId)||null);},
  async addRecord(p){const row={_id:'new-'+(++seq),_version:1,...Object.fromEntries(Object.entries(p.properties).map(([k,v])=>[k,C.value(v)]))};rows[table(p.databaseId)].push(row);writes.push(p);return clone(row);},
  async updateRecord(p){const row=rows[table(p.databaseId)].find(row=>row._id===p.recordId);A.equal(p.expectedVersion,row._version);Object.assign(row,Object.fromEntries(Object.entries(p.properties).map(([k,v])=>[k,C.value(v)])));row._version++;writes.push(p);return clone(row);}
 };
 const store=Store.createStore(db);await store.read();
 const node=()=>({value:'',checked:false,dataset:{},hidden:false,textContent:'',innerHTML:'',listeners:new Map(),classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);},setAttribute(){},querySelectorAll:()=>[],contains:()=>true});
 const api={root:node(),element:node(),closed:false,q:selector=>{if(!fields.has(selector))fields.set(selector,node());return fields.get(selector);},qa:()=>[],on:(selector,event,fn)=>events.set(selector+':'+event,fn),error(){},async close(){this.closed=true;return true;}};
 const context={console,setTimeout:()=>1,clearTimeout(){},document:{activeElement:null}};context.window=context;vm.createContext(context);
 for(const file of ['src/core.js','src/lite/core.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 const L=context.OneDayLite={C:context.OneDayLiteCore,UI:{date:DAY,tab:'tasks'},store,icon:()=>'',
  find:id=>store.get('tasks',id),tasks:()=>store.data.tasks.filter(row=>!row['回收站']),body:row=>row['任务详情']||'',
  read:(key,fallback=null)=>drafts.has(key)?clone(drafts.get(key)):fallback,save:(key,value)=>{drafts.set(key,clone(value));return true;},remove:key=>drafts.delete(key),registerDraftSource:()=>()=>{},
  toast:(message,action)=>notices.push({message,action}),run:async fn=>fn(),confirm:async(...args)=>{dialogs.push(args);return confirm;},
  dialog:options=>{options.onMount?.(api);return api;},dateText:value=>value,updateInert(){},capturingDrafts:false
 };
 context.OneDayLiteEditor={mount(_root,options){const editor={value:options.value,getValue(){return this.value;},setValue(value){this.value=value;},flush(){},whenReady:async()=>{},destroy(){},focus(){},type(value){this.value=value;options.onChange(value);}};editors.push(editor);return editor;}};
 vm.runInContext(fs.readFileSync(path.join(ROOT,'src/lite/dialogs.js'),'utf8'),context,{filename:'src/lite/dialogs.js'});
 return {L,rows,writes,notices,drafts,dialogs,editors,events,fields,api,db,setConfirm:value=>{confirm=value;},category(index){const button={dataset:{recordCategory:String(index)},disabled:false,closest:selector=>selector==='[data-record-category]'?button:null};for(const fn of api.element.listeners.get('click')||[])fn({target:button});}};
}

test('task content keeps a legacy title and body and never duplicates a modern first line',()=>{
 A.equal(C.taskContent({'任务标题':'旧任务','任务详情':'原有步骤\n- [ ] 检查'}),'旧任务\n\n原有步骤\n- [ ] 检查');
 A.equal(C.taskContent({'任务标题':'新任务','任务详情':'## 新任务\n详细内容'}),'## 新任务\n详细内容');
 A.equal(C.taskContent({'任务标题':'仅标题','任务详情':''}),'仅标题');
 A.equal(C.taskTitle('## **整理方案**\n第二行'),'整理方案');
 A.equal(C.taskTitle('C# 练习\n内容'),'C# 练习');
 const long='甲'.repeat(350)+'\n更多内容';A.equal(C.taskTitle(long).length,300);A.equal(C.taskContent({'任务标题':C.taskTitle(long),'任务详情':long}),long);
});

for(const estimate of [10,60,70,480])test('global creation saves an unscheduled task with '+estimate+' planned minutes',async()=>{
 const x=await setup();x.L.openCreationSheet({kind:'task',date:DAY});x.editors[0].type('## 整理方案\n- [ ] 核对数据');x.api.q('#newTaskDuration').value=String(estimate);
 await x.events.get('#newTaskSave:click')();const row=x.rows.tasks[0];
 A.equal(row['任务标题'],'整理方案');A.equal(row['任务详情'],'## 整理方案\n- [ ] 核对数据');A.equal(row['预计时长'],estimate);
 A.equal(row['计划开始时间'],undefined);A.equal(row['计划截止时间'],undefined);
});

test('timeline click owns scheduling even when an older draft contains different times',async()=>{
 const x=await setup();x.drafts.set('newtask.root',{title:'旧草稿',body:'保留正文',date:'2026-10-20',start:'08:00',end:'09:00',estimate:70});
 x.L.openCreationSheet({date:DAY,start:'14:20'});await x.events.get('#newTaskSave:click')();const row=x.rows.tasks[0];
 A.equal(row['任务详情'],'旧草稿\n\n保留正文');A.equal(row['计划开始时间'],DAY+'T14:20:00Z');A.equal(row['计划截止时间'],DAY+'T15:30:00Z');
});

test('global creation cannot inherit a saved draft schedule',async()=>{
 const x=await setup();x.drafts.set('newtask.root',{title:'旧草稿',body:'正文',date:DAY,start:'09:00',end:'10:00'});
 x.L.openCreationSheet();await x.events.get('#newTaskSave:click')();A.equal(x.rows.tasks[0]['计划开始时间'],undefined);A.equal(x.rows.tasks[0]['计划截止时间'],undefined);
});

test('a late timeline click retains a full planned hour across midnight',async()=>{
 const x=await setup();x.L.openCreationSheet({date:DAY,start:'23:50'});x.editors[0].type('跨日任务');x.api.q('#newTaskDuration').value='60';
 await x.events.get('#newTaskSave:click')();A.equal(x.rows.tasks[0]['计划开始时间'],DAY+'T23:50:00Z');A.equal(x.rows.tasks[0]['计划截止时间'],'2026-10-28T00:50:00Z');
});

test('unified draft changes derive title and preserve raw legacy base during sync',async()=>{
 const row={_id:'t',_version:1,'任务标题':'旧标题','任务详情':'旧正文'},x=await setup([row]);
 const draft=x.L.draftSession('tasks','t',{'任务标题':row['任务标题'],'任务详情':C.taskContent(row)},null,{unifiedContent:true});
 draft.sync({...row,'任务标题':'远端标题','任务详情':'远端正文'});A.equal(draft.values['任务详情'],'远端标题\n\n远端正文');A.equal(draft.base['任务详情'],'远端正文');
 draft.change('任务详情','## 新首行\n完整正文');A.equal(draft.values['任务标题'],'新首行');
});

test('a unified content edit keeps its title and body together when an older client changes the title',async()=>{
 const row={_id:'t',_version:1,'任务标题':'原首行','任务详情':'原首行\n原正文'},x=await setup([row]);
 const draft=x.L.draftSession('tasks','t',{'任务标题':row['任务标题'],'任务详情':row['任务详情']},null,{unifiedContent:true});
 draft.change('任务详情','原首行\n本机修改的正文');x.rows.tasks[0]['任务标题']='其他设备的新标题';x.rows.tasks[0]._version++;
 await x.L.store.read();draft.sync(x.L.store.get('tasks','t'));
 A.equal(draft.values['任务标题'],'原首行');A.equal(draft.base['任务标题'],'原首行');
 await A.rejects(draft.flush(),/其他设备已修改/);A.equal(x.rows.tasks[0]['任务详情'],'原首行\n原正文');A.equal(x.drafts.get('draft.tasks.t').fields['任务详情'],'原首行\n本机修改的正文');
});

test('canceling deletion leaves the task and descendants untouched',async()=>{
 const x=await setup([{_id:'p',_version:1,'任务标题':'父任务'},{_id:'c',_version:1,'任务标题':'子任务','父任务ID':'p'}]);x.setConfirm(false);
 A.equal(await x.L.deleteTask('p'),false);A.equal(x.writes.length,0);A.match(x.dialogs[0][1],/1.*子任务/);
});

test('deletion pauses running descendants, retains execution logs and can undo the group',async()=>{
 const start=new Date(Date.now()-3600000).toISOString(),x=await setup([{_id:'p',_version:1,'任务标题':'父任务','任务状态':C.STATUS[0]},{_id:'c',_version:1,'任务标题':'子任务','父任务ID':'p','任务状态':'进行中','状态开始时间':start}]);
 A.equal(await x.L.deleteTask('p'),true);A.ok(x.rows.tasks.every(row=>row['回收站']));A.equal(x.rows.tasks[1]['任务状态'],'暂停');A.equal(x.rows.logs[0]['状态'],'进行中');A.match(x.dialogs[0][2],/暂停/);
 await x.notices.at(-1).action.run();A.ok(x.rows.tasks.every(row=>row['回收站']===false));A.equal(x.rows.logs.length,1);A.equal(x.notices.at(-1).message,'已撤销删除');
});

test('deletion propagates a failed pause instead of proceeding to trash',async()=>{
 const x=await setup([{_id:'t',_version:1,'任务标题':'执行中','任务状态':'进行中'}]);x.db.updateRecord=async()=>{throw Error('暂停保存失败');};
 await A.rejects(x.L.deleteTask('t'),/暂停保存失败/);A.equal(x.rows.tasks[0]['回收站'],undefined);
});

test('parking assignment previews the selected date and estimate, and only schedules on save',async()=>{
 const x=await setup([{_id:'t',_version:1,'任务标题':'待安排','预计时长':70}]);x.L.openPlan('t',{date:DAY});
 A.equal(x.api.q('#planStart').value,DAY+'T09:00');A.equal(x.api.q('#planEnd').value,DAY+'T10:10');A.equal(x.writes.length,0);
 await x.events.get('#savePlan:click')({currentTarget:null});A.equal(x.rows.tasks[0]['计划开始时间'],DAY+'T09:00:00Z');A.equal(x.rows.tasks[0]['计划截止时间'],DAY+'T10:10:00Z');
});


test('unified capture defaults to pending and creates other categories in the same library model',async()=>{
 const x=await setup();x.L.openCreationSheet();A.equal(x.api.root.dataset.category,'待办');A.equal(x.editors.length,1);x.editors[0].type('## 一个灵感\n保存完整正文');x.category(1);
 await x.events.get('#newTaskSave:click')();A.equal(x.rows.tasks.length,0);A.equal(x.rows.notes.length,1);A.equal(x.rows.notes[0]['便签分类'],'灵感');A.equal(x.rows.notes[0]['便签内容'],'## 一个灵感\n保存完整正文');
});
test('restored custom-category note drafts save as records and preserve their full text',async()=>{
 for(const key of ['newrecord.root','newnote.root']){
  const x=await setup(),body='## 原分类资料\n\n完整正文与 **格式**',savedNote={_id:'saved-note',_version:1,'便签分类':'旧分类','便签内容':'已有笔记'};
  x.rows.notes.push(clone(savedNote));await x.L.store.read();x.drafts.set(key,{body,category:'自定义分类'});x.L.openCreationSheet();
  await x.events.get('#newTaskSave:click')();A.equal(x.rows.tasks.length,0);A.equal(x.rows.notes.length,2);
  A.equal(x.rows.notes[1]['便签分类'],'记录');A.equal(x.rows.notes[1]['便签内容'],body);A.deepEqual(x.rows.notes[0],savedNote);A.equal(x.drafts.has(key),false);
 }
});
test('changing capture category keeps the single Markdown buffer and duration',async()=>{
 const x=await setup();x.L.openCreationSheet();x.editors[0].type('同一条记录');x.api.q('#newTaskDuration').value='80';x.events.get('#newTaskDuration:input')();x.category(1);x.category(0);
 await x.events.get('#newTaskSave:click')();A.equal(x.rows.tasks.length,1);A.equal(x.rows.notes.length,0);A.equal(x.rows.tasks[0]['任务详情'],'同一条记录');A.equal(x.rows.tasks[0]['预计时长'],80);
});
test('undo can cancel drag deletion before an outstanding editor upload finishes',async()=>{
 const x=await setup([{_id:'p',_version:1,'任务标题':'保留记录'}]);let release,undone=false;const before=new Promise(resolve=>release=resolve),pending=x.L.deleteTask('p',{confirm:false,onUndo:()=>undone=true,beforeDelete:()=>before});
 A.equal(x.dialogs.length,0);A.equal(x.notices.at(-1).action.label,'撤销');await x.notices.at(-1).action.run();A.equal(undone,true);release();A.equal(await pending,false);A.equal(x.writes.length,0);A.equal(x.rows.tasks[0]['回收站'],undefined);
});
