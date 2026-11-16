'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Store=require('../../src/lite/store.js');
const ROOT=path.resolve(__dirname,'../..');
const IDS=Store.IDS;
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

async function setup(extraTasks=[]){
 const disk=new Map(),timers=new Map(),writes=[],adds=[],messages=[];let timerSeq=0,rowSeq=0,failStorage=false;
 let write=async()=>{},add=async()=>{};
 const rows=Object.fromEntries(Object.keys(IDS).map(key=>[key,[]]));
 rows.tasks=[
  {_id:'a','任务标题':'任务 A','任务详情':'正文 A','任务状态':'收集（未开始）','计划开始时间':'2026-10-19T09:15:00Z'},
  {_id:'b','任务标题':'任务 B','任务详情':'正文 B','任务状态':'收集（未开始）','计划开始时间':'2026-10-19T11:30:00Z'}
 ];
 rows.tasks.push(...extraTasks);
 const table=id=>Object.keys(IDS).find(key=>IDS[key]===id);
 const db={query:async p=>({results:structuredClone(rows[table(p.databaseId)]),hasMore:false}),
  async updateRecord(p){writes.push(structuredClone(p));await write(p);const row=rows[table(p.databaseId)].find(r=>r._id===p.recordId);for(const [key,value]of Object.entries(p.properties))row[key]=Object.values(value)[0];return {...row};},
  async addRecord(p){adds.push(structuredClone(p));await add(p);const row={_id:'new-'+(++rowSeq)};for(const [key,value]of Object.entries(p.properties))row[key]=Object.values(value)[0];rows[table(p.databaseId)].push(row);return {id:row._id};}
 };
 const store=Store.createStore(db);await store.read();
 const elements=Object.fromEntries(['toastRoot','syncLabel','syncButton','connectionNotice','environmentLabel'].map(id=>[id,{innerHTML:'',textContent:''}]));
 const context={console,setTimeout:(fn,ms)=>{timers.set(++timerSeq,{fn,ms});return timerSeq;},clearTimeout:id=>timers.delete(id),
  document:{documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[],getElementById:id=>elements[id]},
  localStorage:{get length(){return disk.size;},key:i=>[...disk.keys()][i]??null,getItem:key=>disk.get(key)??null,setItem(key,value){if(failStorage)throw Error('storage unavailable');disk.set(key,String(value));},removeItem:key=>disk.delete(key)},Node:{TEXT_NODE:3,ELEMENT_NODE:1}
 };
 context.window=context;vm.createContext(context);
 for(const file of ['src/core.js','src/lite/core.js','src/lite/themes.js','src/lite/ui.js','src/lite/views.js','src/lite/dialogs.js','src/lite/editor.js','src/lite/gestures.js','src/lite/timeline.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 const L=context.OneDayLite;L.store=store;L.toast=message=>messages.push(message);
 return {L,context,Editor:context.OneDayLiteEditor,rows,writes,adds,timers,messages,
  failStorage:value=>failStorage=value,setWrite:fn=>write=fn,setAdd:fn=>add=fn,
  async runTimers(ms){for(const [id,entry]of [...timers])if(entry.ms===ms){timers.delete(id);await entry.fn();}}
 };
}

// Dialog/event host for the real openDayTimeline binding. Layout and Markdown
// rendering remain separate concerns; field values and events are native-shaped.
function openSheet(x){
 const listeners=new Map(),frames=new Map(),mounted=[];let frame=0;
 const classes={add(){},remove(){}};
 const header={children:[],append(...nodes){this.children.push(...nodes);}};
 x.context.document.createElement=tag=>({tagName:tag.toUpperCase(),attrs:{},className:'',innerHTML:'',setAttribute(name,value){this.attrs[name]=String(value);}});
 const title={value:'',readOnly:false},banner={innerHTML:''},status={textContent:'',className:'',title:''},area={value:''};
 const root={innerHTML:'',querySelector(selector){return {'[data-day-editor-host]':{},'[data-day-task-title]':title,'[data-day-draft-banner]':banner,'[data-day-save-state]':status,'[data-day-worklog] textarea':area}[selector]||null;},querySelectorAll:()=>[]};
 const element={classList:classes,addEventListener:(type,fn)=>listeners.set(type,fn)};
 x.context.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};x.context.cancelAnimationFrame=id=>frames.delete(id);
 x.context.OneDayLiteAttachments={create:()=>({})};
 x.context.OneDayLiteEditor={...x.Editor,mount(_root,options){let raw=options.value,destroyed=false,readOnly=false;const buffer=x.Editor.createContentBuffer({value:raw,onChange:options.onChange});
  const instance={type:value=>raw=value,getValue:()=>buffer.value,get pendingUploads(){return buffer.pending;},upload:gate=>buffer.upload({name:'资料.pdf',type:'application/pdf'},{uploadFile:()=>gate.promise},options.owner),setValue(value){raw=value;buffer.setValue(value,false);},setReadOnly:value=>readOnly=value,get readOnly(){return readOnly;},flush(){if(!destroyed)buffer.setValue(raw);return buffer.value;},destroy(){destroyed=true;},async whenReady(){instance.flush();await buffer.whenReady();return buffer.value;}};mounted.push(instance);return instance;
 }};
 let options;const api={root:{classList:classes,inert:false},element,q:selector=>selector==='.dialog-header'?header:root,qa:()=>[],closed:false,async close(){if(await options.onClose()!==false)this.closed=true;return this.closed;}};
 x.L.dialog=value=>{options=value;options.onMount(api);return api;};
 x.L.openDayTimeline('2026-10-19','a');
 function paint(){for(const [id,fn]of [...frames]){frames.delete(id);fn();}}paint();
 return {api,mounted,title,banner,status,area,paint,emit(type,selector,extra={}){const target={...extra,closest:s=>s===selector?target:null};return listeners.get(type)?.({target,preventDefault(){},...extra.event});}};
}

// A DOM boundary around the production content buffer. Delayed text is only
// committed by flush(), so destruction without capturing loses it in this host.
function editor(x,day,id){
 let raw=day.session(id).values['任务详情'],destroyed=false,readOnly=false;
 const buffer=x.Editor.createContentBuffer({value:raw,onChange:value=>day.changeBody(id,value,api)});
 const api={getValue:()=>buffer.value,get pendingUploads(){return buffer.pending;},
  type:value=>raw=value,setValue(value){buffer.setValue(value,false);raw=value;},
  setReadOnly:value=>readOnly=!!value,get readOnly(){return readOnly;},get destroyed(){return destroyed;},
  flush(){if(!destroyed)buffer.setValue(raw);return buffer.value;},destroy(){destroyed=true;},
  async whenReady(){api.flush();await buffer.whenReady();return buffer.value;},
  upload:gate=>buffer.upload({name:'资料.pdf',type:'application/pdf'},{uploadFile:()=>gate.promise},{type:'task',id})
 };return api;
}

test('Day sessions keep per-task drafts immediately and autosave only their changed fields',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),a=day.session('a'),b=day.session('b');
 A.equal(day.session('a'),a);a.change('任务标题','新标题 A');day.changeBody('a','新正文 A');day.changeBody('b','新正文 B');
 A.equal(x.L.read('draft.tasks.a').fields['任务标题'],'新正文 A');
 A.equal(x.L.read('draft.tasks.a').fields['任务详情'],'新正文 A');
 A.equal(x.L.read('draft.tasks.b').fields['任务详情'],'新正文 B');A.equal(x.writes.length,0);
 await x.runTimers(650);
 A.equal(x.writes.length,2);
 A.deepEqual(Object.keys(x.writes.find(p=>p.recordId==='a').properties).sort(),['任务标题','任务详情'].sort());
 A.deepEqual(Object.keys(x.writes.find(p=>p.recordId==='b').properties).sort(),['任务标题','任务详情'].sort());
 A.equal(x.rows.tasks[0]['计划开始时间'],'2026-10-19T09:15:00Z');
 A.equal(x.rows.tasks[1]['计划开始时间'],'2026-10-19T11:30:00Z');
 A.equal(a.dirty,false);A.equal(b.dirty,false);A.equal(await day.close(),true);
});

test('releasing a Day editor captures delayed DOM text before destroying it',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),first=editor(x,day,'a');day.setEditor('a',first);
 first.type('尚未触发重绘的正文');day.releaseEditor();
 A.equal(first.destroyed,true);A.equal(day.session('a').values['任务详情'],'尚未触发重绘的正文');
 A.equal(x.L.read('draft.tasks.a').fields['任务详情'],'尚未触发重绘的正文');
 const reopened=editor(x,day,'a');day.setEditor('a',reopened);
 A.equal(reopened.getValue(),'尚未触发重绘的正文');A.equal(x.writes.length,0);
 A.equal(await day.close(),true);A.equal(x.rows.tasks[0]['任务详情'],'尚未触发重绘的正文');
});

test('closing waits for a retired editor upload and captures every visited task',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),gate=deferred(),first=editor(x,day,'a');day.setEditor('a',first);
 first.type('任务 A 最后输入');first.flush();const uploaded=first.upload(gate);day.releaseEditor();
 const second=editor(x,day,'b');day.setEditor('b',second);second.type('任务 B 最后输入');
 let closed=false;const closing=day.close().then(value=>{closed=value;return value;});
 await Promise.resolve();A.equal(closed,false);A.equal(x.writes.length,0);A.equal(x.L.hasUnsavedChanges(),true);
 gate.resolve({url:'/api/oneday/files/f'});await uploaded;A.equal(await closing,true);
 A.match(x.rows.tasks[0]['任务详情'],/^任务 A 最后输入\n\n\[📎 资料.pdf\]/);
 A.equal(x.rows.tasks[1]['任务详情'],'任务 B 最后输入');
 A.equal(first.destroyed,true);A.equal(second.destroyed,true);A.equal(x.L.hasUnsavedChanges(),false);
 A.equal([...x.timers.values()].filter(t=>t.ms===650).length,0);
});

test('a late upload from a retired editor preserves fresh text in the remounted task editor',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),gate=deferred(),first=editor(x,day,'a');day.setEditor('a',first);
 const uploaded=first.upload(gate);day.releaseEditor();
 const current=editor(x,day,'a');day.setEditor('a',current);current.type('重开后尚未提交的新正文');
 gate.resolve({url:'/api/oneday/files/late'});await uploaded;
 A.equal(day.session('a').values['任务详情'],'重开后尚未提交的新正文\n\n[📎 资料.pdf](/api/oneday/files/late)');
 A.equal(current.getValue(),day.session('a').values['任务详情']);
 A.equal(await day.close(),true);A.equal(x.rows.tasks[0]['任务详情'],current.getValue());
});

test('failed Day saves keep all sessions alive until the user accepts closing with drafts',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),a=day.session('a');day.session('b').change('任务标题','已保存 B');
 a.change('任务详情','失败时保留 A');x.setWrite(async p=>{if(p.recordId==='a')throw Error('offline');});
 const confirmations=[];
 A.equal(await day.close(async error=>{confirmations.push(error.message);return false;}),false);
 A.deepEqual(confirmations,['offline']);A.equal(day.session('a'),a);A.equal(x.rows.tasks[1]['任务标题'],'已保存 B');
 a.change('任务详情','取消关闭后继续输入');
 A.equal(await day.close(async()=>true),true);
 A.equal(x.L.read('draft.tasks.a').fields['任务详情'],'取消关闭后继续输入');
 const reopened=x.L.createDayDrafts(),session=reopened.session('a'),surface=editor(x,reopened,'a');reopened.setEditor('a',surface);
 A.equal(surface.readOnly,true);A.equal(session.values['任务详情'],'任务 A\n\n正文 A');
 A.match(x.L.draftHTML(session),/恢复草稿/);A.match(x.L.draftHTML(session),/导出草稿/);A.match(x.L.draftHTML(session),/舍弃草稿/);
 x.setWrite(async()=>{});session.restore();
 A.equal(surface.readOnly,false);A.equal(surface.getValue(),'取消关闭后继续输入');
 A.equal(await reopened.close(),true);A.equal(x.rows.tasks[0]['任务详情'],'取消关闭后继续输入');
 A.equal(x.L.read('draft.tasks.a'),null);
});

test('discarding a recovered Day draft unlocks the current server values',async()=>{
 const x=await setup();x.L.save('draft.tasks.a',{base:x.rows.tasks[0],fields:{'任务标题':'旧草稿标题','任务详情':'旧草稿正文'}});
 const day=x.L.createDayDrafts(),session=day.session('a'),surface=editor(x,day,'a');day.setEditor('a',surface);
 A.equal(surface.readOnly,true);session.discard();
 A.equal(surface.readOnly,false);A.equal(surface.getValue(),'任务 A\n\n正文 A');A.equal(session.values['任务标题'],'任务 A');
 A.equal(x.L.read('draft.tasks.a'),null);A.equal(await day.close(),true);A.equal(x.writes.length,0);
});

test('Day refuses a close that would lose both cloud and local copies',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),session=day.session('a');session.change('任务详情','仍在会话中的内容');
 x.failStorage(true);x.setWrite(async()=>{throw Error('offline');});let confirmations=0;
 A.equal(await day.close(async()=>{confirmations++;return true;}),false);
 A.equal(confirmations,0);A.equal(day.session('a').values['任务详情'],'仍在会话中的内容');A.equal(x.L.hasUnsavedChanges(),true);
 A.ok(x.messages.some(message=>message.includes('草稿')&&message.includes('关闭')));
 x.failStorage(false);x.setWrite(async()=>{});A.equal(await day.close(),true);
 A.equal(x.rows.tasks[0]['任务详情'],'仍在会话中的内容');
});

test('Day worklog drafts are captured from bound textareas without a network write and survive reopening',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),a={value:''},b={value:''};day.bindWorklog('a',a);a.value='任务 A 尚未提交的记录';
 A.equal(x.L.flushDrafts(),true);A.equal(x.L.read('worklog.a'),'任务 A 尚未提交的记录');
 day.unbindWorklog();day.bindWorklog('b',b);b.value='任务 B 尚未提交的记录';
 A.equal(x.L.flushDrafts(),true);A.equal(x.L.read('worklog.b'),'任务 B 尚未提交的记录');
 A.equal(x.writes.length,0);A.equal(x.adds.length,0);A.equal(await day.close(),true);
 const reopened=x.L.createDayDrafts(),restored={value:''};reopened.bindWorklog('a',restored);
 A.equal(restored.value,'任务 A 尚未提交的记录');A.equal(x.L.hasUnsavedChanges(),true);A.equal(await reopened.close(),true);
});

test('worklog acknowledgement clears only the submitted task and unchanged input snapshot',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),a={value:''},b={value:''},gate=deferred();day.bindWorklog('a',a);a.value='  提交 A 的记录  ';
 x.setAdd(()=>gate.promise);const saving=day.submitWorklog('a');
 a.value='提交期间补充 A';day.changeWorklog('a',a.value);day.unbindWorklog();day.bindWorklog('b',b);b.value='B 仍在输入';day.changeWorklog('b',b.value);
 gate.resolve();await saving;
 A.equal(x.rows.notes[0]['关联任务ID'],'a');A.equal(x.rows.notes[0]['便签内容'],'提交 A 的记录');
 A.equal(x.L.read('worklog.a'),'提交期间补充 A');A.equal(b.value,'B 仍在输入');
 A.equal(x.L.read('worklog.b'),'B 仍在输入');
 x.setAdd(async()=>{});await day.submitWorklog('b');
 A.equal(b.value,'');A.equal(x.L.read('worklog.b'),null);A.equal(x.L.read('worklog.a'),'提交期间补充 A');
 A.equal(await day.close(),true);
});

test('a failed Day worklog submission keeps its raw draft for the next opening',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),area={value:''};day.bindWorklog('a',area);area.value='  暂时无法上传的记录  ';
 x.setAdd(async()=>{throw Error('worklog offline');});await A.rejects(day.submitWorklog('a'),/worklog offline/);
 A.equal(area.value,'  暂时无法上传的记录  ');A.equal(x.L.read('worklog.a'),area.value);A.equal(await day.close(),true);
 const reopened=x.L.createDayDrafts(),restored={value:''};reopened.bindWorklog('a',restored);
 A.equal(restored.value,'  暂时无法上传的记录  ');A.equal(await reopened.close(),true);
});

test('the Day Sheet binds title and body edits to the recoverable task session before tab changes',async()=>{
 const x=await setup(),sheet=openSheet(x);sheet.mounted[0].type('从 Day 修改标题');sheet.mounted[0].flush();
 A.equal(x.L.read('draft.tasks.a')?.fields['任务标题'],'从 Day 修改标题');
 sheet.mounted[0].type('切页签前最后输入的正文');sheet.emit('click','[data-day-action]',{dataset:{dayAction:'tab',tab:'logs'}});sheet.paint();
 A.equal(x.L.read('draft.tasks.a').fields['任务详情'],'切页签前最后输入的正文');
 A.equal(await sheet.api.close(),true);A.equal(x.rows.tasks[0]['任务详情'],'切页签前最后输入的正文');
});

test('the Day Sheet close handler waits for a failed save and honors cancel without destroying drafts',async()=>{
 const x=await setup(),sheet=openSheet(x),gate=deferred(),confirmed=[];
 x.setWrite(()=>gate.promise);x.L.confirm=async(...args)=>{confirmed.push(args);return false;};
 sheet.mounted[0].type('等待保存的标题');sheet.mounted[0].flush();
 const closing=sheet.api.close();await Promise.resolve();await Promise.resolve();A.equal(sheet.api.closed,false);
 gate.reject(Error('save offline'));A.equal(await closing,false);
 A.equal(confirmed.length,1);A.equal(confirmed[0][2],'保留草稿并关闭');
 A.equal(x.L.read('draft.tasks.a').fields['任务标题'],'等待保存的标题');A.equal(sheet.api.root.inert,false);
 x.setWrite(async()=>{});A.equal(await sheet.api.close(),true);
});

test('the Day Sheet status menu routes through the shared task-status action',async()=>{
 const x=await setup(),sheet=openSheet(x),shared=[];let direct=0;
 x.L.changeStatus=async(id,value)=>shared.push({id,value});x.L.store.setStatus=async()=>{direct++;};
 sheet.emit('change','[data-day-status-range]',{value:'3'});await Promise.resolve();await Promise.resolve();
 A.deepEqual(shared,[{id:'a',value:'完成'}]);A.equal(direct,0);A.equal(await sheet.api.close(),true);
});

test('the Day save-state label acknowledges a successful Sites cloud write',async()=>{
 const x=await setup();x.context.__ONEDAY_SITES__=true;const sheet=openSheet(x);
 sheet.mounted[0].type('云端确认的标题');sheet.mounted[0].flush();await x.runTimers(650);
 A.equal(x.rows.tasks[0]['任务标题'],'云端确认的标题');A.equal(sheet.status.textContent,'云端已保存');
 A.equal(await sheet.api.close(),true);
});

test('pre-delete Day flush waits for the selected task retired upload and preserves its current text',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),gate=deferred(),retired=editor(x,day,'a');day.setEditor('a',retired);
 const uploading=retired.upload(gate);day.releaseEditor();const current=editor(x,day,'a');day.setEditor('a',current);current.type('删除前首行\n\n保留当前正文');
 let ready=false;const flushing=day.flushTask('a').then(()=>ready=true);await Promise.resolve();A.equal(ready,false);
 gate.resolve({url:'/api/oneday/files/before-delete'});await uploading;await flushing;
 A.equal(ready,true);A.equal(x.rows.tasks[0]['任务标题'],'删除前首行');A.equal(x.rows.tasks[0]['任务详情'],'删除前首行\n\n保留当前正文\n\n[📎 资料.pdf](/api/oneday/files/before-delete)');
 A.equal(await day.close(),true);
});

test('parent Day deletion waits for a retired child upload and saves its content before trash',async()=>{
 const x=await setup([{_id:'child','任务标题':'子任务','任务详情':'子任务','任务状态':'收集（未开始）','父任务ID':'a','任务类型':'子任务'}]),sheet=openSheet(x),gate=deferred(),deleted=deferred();let deletes=0;
 sheet.emit('click','[data-day-action]',{dataset:{dayAction:'select',id:'child'}});sheet.paint();const child=sheet.mounted.at(-1);child.type('子任务最后输入');child.flush();const uploading=child.upload(gate);
 sheet.emit('click','[data-day-action]',{dataset:{dayAction:'select',id:'a'}});sheet.paint();
 x.L.deleteTask=async id=>{deletes++;A.equal(id,'a');A.equal(x.rows.tasks.find(t=>t._id==='child')['任务详情'],'子任务最后输入\n\n[📎 资料.pdf](/api/oneday/files/child-before-trash)');deleted.resolve();return true;};
 sheet.emit('click','[data-day-action]',{dataset:{dayAction:'delete'}});for(let i=0;i<8;i++)await Promise.resolve();A.equal(deletes,0,'trash waits while an affected child upload remains pending');
 gate.resolve({url:'/api/oneday/files/child-before-trash'});await uploading;await deleted.promise;A.equal(deletes,1);A.equal(await sheet.api.close(),true);
});
test('a retired upload preserves whitespace-prefixed content and newer visible text',async()=>{
 const x=await setup(),day=x.L.createDayDrafts(),gate=deferred(),first=editor(x,day,'a');day.setEditor('a',first);
 first.type('  保留缩进的原文');first.flush();const uploaded=first.upload(gate);day.releaseEditor();const current=editor(x,day,'a');day.setEditor('a',current);current.type('  重开后补充的新正文');
 gate.resolve({url:'/api/oneday/files/indented'});await uploaded;
 A.equal(day.session('a').values['任务详情'],'  重开后补充的新正文\n\n[📎 资料.pdf](/api/oneday/files/indented)');A.equal(current.getValue(),day.session('a').values['任务详情']);A.equal(await day.close(),true);
});
