'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../../src/lite/core.js'),Store=require('../../src/lite/store.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const wall=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00Z`;
const plans=(start,end)=>({'计划开始时间':{date:wall(start)},'计划截止时间':{date:wall(end)}});
const ago=minutes=>new Date(Date.now()-minutes*60000);
async function fixture(status=C.STATUS[0]){
 const tables=Object.fromEntries(Object.keys(Store.IDS).map(k=>[k,[]])),writes=[];
 tables.tasks.push({_id:'t',_version:1,'任务标题':'核对方案','任务类型':'主任务','任务状态':status,'状态开始时间':ago(60).toISOString(),'计划开始时间':wall(ago(-120)),'计划截止时间':wall(ago(-180))});
 const table=id=>Object.keys(Store.IDS).find(k=>Store.IDS[k]===id);
 const db={taskFields:['允许并行'],query:async p=>({results:copy(tables[table(p.databaseId)]),hasMore:false}),getRecord:async p=>copy(tables[table(p.databaseId)].find(r=>r._id===p.recordId)),
  updateRecord:async p=>{if(db.beforeWrite)await db.beforeWrite(p);const r=tables[table(p.databaseId)].find(r=>r._id===p.recordId);if(r._version!==p.expectedVersion)throw Error('版本冲突');for(const[k,v]of Object.entries(p.properties))r[k]=C.value(v);r._version++;writes.push(copy(p));return copy(r);},
  addRecord:async p=>{const r={_id:'log-'+tables.logs.length,_version:1,...Object.fromEntries(Object.entries(p.properties).map(([k,v])=>[k,C.value(v)]))};tables[table(p.databaseId)].push(r);return copy(r);}
 };
 const store=Store.createStore(db);await store.read();
 const L={C,UI:{},store,find:id=>store.get('tasks',id),icon:()=>''},context={window:{OneDayLite:L},setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../../src/lite/dialogs.js'),'utf8'),context);
 return {L,store,db,tables,writes};
}
test('schedule state follows local wall-clock end, not start or UTC interpretation',async()=>{
 const {L}=await fixture(),now=new Date(2026,9,28,12,0),row={'任务状态':'暂停','计划开始时间':'2026-10-28T10:00:00Z','计划截止时间':'2026-10-28T13:00:00Z'};
 A.equal(L.scheduleStatus(row,now),'暂停');A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-28T12:00:00Z'},now),'完成');
 A.equal(L.scheduleStatus({...row,'任务状态':'完成'},now),C.STATUS[0]);A.equal(L.scheduleStatus({...row,'计划开始时间':null,'计划截止时间':null},now),C.STATUS[0]);
 A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-29T00:00:00Z'},now),'暂停');
 A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-28T12:00:30Z'},new Date(2026,9,28,12,0,10)),'暂停');
 A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-28T12:00:05Z'},new Date(2026,9,28,12,0,10)),'完成');
});
test('offset-bearing plans retain their written wall-clock status and endpoint precision',async()=>{
 const {L}=await fixture(),now=new Date(2026,9,28,12,0),row={'任务状态':C.STATUS[0],'任务类型':'主任务','计划开始时间':'2026-10-28T10:00:00+08:00','计划截止时间':'2026-10-28T13:00:00+08:00'};
 const plan=C.schedulePlan([],row);A.equal(plan.start,600);A.equal(plan.end,780);
 A.equal(L.scheduleStatus(row,now),C.STATUS[0]);
 A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-28T11:59:59.999+08:00'},now),'完成');
 A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-28T12:00:00.101+08:00'},new Date(2026,9,28,12,0,0,100)),C.STATUS[0]);
 A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-28T12:00:00.101+08:00'},new Date(2026,9,28,12,0,0,101)),'完成');
 A.equal(L.scheduleStatus({...row,'计划截止时间':'2026-10-28T11:59:59.999-08:00'},now),'完成');
});
test('rescheduling past completes pending task without inventing execution',async()=>{
 const x=await fixture(),base=copy(x.L.find('t'));await x.L.saveTaskSchedule('t',plans(ago(40),ago(10)),base);
 A.equal(x.L.find('t')['任务状态'],'完成');A.equal(x.L.find('t')['任务进度'],100);A.equal(C.taskTime(x.L.find('t'),x.tables.logs).doing,0);
});
test('elapsed scheduling completes a legacy task whose current and expected status are absent',async()=>{
 const x=await fixture();delete x.tables.tasks[0]['任务状态'];await x.store.read();const base=copy(x.L.find('t')),plan=plans(ago(40),ago(10));
 await x.L.saveTaskSchedule('t',plan,base);
 A.equal(x.tables.tasks[0]['任务状态'],'完成');A.equal(x.tables.tasks[0]['计划截止时间'],plan['计划截止时间'].date);A.equal(C.taskTime(x.L.find('t'),x.tables.logs).doing,0);
});
for(const field of ['任务状态','状态开始时间'])test('legacy status normalization retains the remote '+field+' conflict guard',async()=>{
 const x=await fixture();delete x.tables.tasks[0]['任务状态'];await x.store.read();const base=copy(x.L.find('t'));
 x.tables.tasks[0][field]=field==='任务状态'?'进行中':ago(30).toISOString();x.tables.tasks[0]._version++;const remote=copy(x.tables.tasks[0]);
 await A.rejects(x.store.setStatus('t','完成',new Date().toISOString(),base),/其他设备已切换任务状态/);
 A.deepEqual(x.tables.tasks[0],remote);A.equal(x.writes.length,0);A.equal(x.tables.logs.length,0);
});
test('a running task closes its actual segment, not the duration dragged onto the calendar',async()=>{
 const x=await fixture('进行中');await x.L.saveTaskSchedule('t',plans(ago(25),ago(10)),copy(x.L.find('t')));
 const doing=x.tables.logs.find(l=>l['状态']==='进行中');A.ok(doing);A.ok(doing['持续时长']>=1&&doing['持续时长']<1.01);A.equal(x.L.find('t')['任务状态'],'完成');
});
test('completed task moved into current or future interval reopens without starting a timer',async()=>{
 const x=await fixture('完成');await x.L.saveTaskSchedule('t',plans(ago(20),ago(-20)),copy(x.L.find('t')));
 A.equal(x.L.find('t')['任务状态'],C.STATUS[0]);A.equal(x.L.find('t')['任务进度'],0);A.equal(x.tables.logs.length,0);
});
test('return to todo clears schedule and returns running task to pending in one visible update',async()=>{
 const x=await fixture('进行中'),base=copy(x.L.find('t'));let release;const gate=new Promise(r=>release=r);x.db.beforeWrite=()=>gate;
 const saving=x.L.saveTaskSchedule('t',{'计划开始时间':{date:null},'计划截止时间':{date:null}},base);await new Promise(setImmediate);
 A.equal(x.L.find('t')['任务状态'],C.STATUS[0]);A.equal(x.L.find('t')['计划开始时间'],null);release();await saving;
 A.equal(x.tables.tasks[0]['任务状态'],C.STATUS[0]);A.equal(x.tables.logs.filter(l=>l['状态']==='进行中').length,1);
});
test('rejected schedule does not perform an automatic status transition',async()=>{
 const x=await fixture(),base=copy(x.L.find('t'));x.db.beforeWrite=()=>{throw Error('无法保存排期');};
 await A.rejects(x.L.saveTaskSchedule('t',plans(ago(40),ago(10)),base),/无法保存排期/);A.equal(x.tables.tasks[0]['任务状态'],C.STATUS[0]);A.equal(x.tables.logs.length,0);A.equal(x.L.find('t')['计划开始时间'],base['计划开始时间']);
});
test('failed automatic status reports partial success and shows confirmed schedule and original state',async()=>{
 const x=await fixture(),base=copy(x.L.find('t')),plan=plans(ago(40),ago(10));x.db.beforeWrite=p=>{if(p.properties['任务状态'])throw Error('状态写入失败');};
 await A.rejects(x.L.saveTaskSchedule('t',plan,base),e=>e.partial&&/计划已保存/.test(e.message));A.equal(x.L.find('t')['计划开始时间'],plan['计划开始时间'].date);A.equal(x.L.find('t')['任务状态'],C.STATUS[0]);
});
for(const remoteStatus of [C.STATUS[0],'完成'])test('remote rescheduling blocks automatic completion even when fresh status is '+remoteStatus,async()=>{
 const x=await fixture(),base=copy(x.L.find('t')),plan=plans(ago(40),ago(10)),future=plans(ago(-30),ago(-60)),update=x.db.updateRecord;let statusCalls=0;
 x.db.kind='sites';x.db.updateRecord=async p=>{const saved=await update(p);if(p.properties['计划截止时间'])Object.assign(x.tables.tasks[0],{'计划开始时间':future['计划开始时间'].date,'计划截止时间':future['计划截止时间'].date,'任务状态':remoteStatus,_version:saved._version+1});return saved;};
 x.db.transitionStatus=async p=>{statusCalls++;const row=x.tables.tasks[0];A.equal(p.expectedVersion,row._version);row['任务状态']=p.status;row._version++;return {task:copy(row)};};
 await A.rejects(x.L.saveTaskSchedule('t',plan,base),e=>e.partial&&/计划已保存/.test(e.message)&&e.scheduledTask['计划截止时间']===plan['计划截止时间'].date);
 A.equal(statusCalls,0);A.equal(x.writes.length,1);A.equal(x.tables.logs.length,0);A.equal(x.tables.tasks[0]['任务状态'],remoteStatus);
 A.equal(x.tables.tasks[0]['计划开始时间'],future['计划开始时间'].date);A.equal(x.tables.tasks[0]['计划截止时间'],future['计划截止时间'].date);
});
test('canceled conflicting schedule leaves state and time untouched',async()=>{
 const x=await fixture(),base=copy(x.L.find('t')),plan=plans(ago(40),ago(10));x.tables.tasks.push({...base,_id:'busy','计划开始时间':plan['计划开始时间'].date,'计划截止时间':plan['计划截止时间'].date});await x.store.read();
 const result=await x.L.saveTaskSchedule('t',plan,base,{present:async()=> 'cancel'});A.equal(result,null);A.equal(x.writes.length,0);A.equal(x.tables.tasks[0]['任务状态'],C.STATUS[0]);
});
test('status follows the accepted free slot rather than the rejected past candidate',async()=>{
 const x=await fixture(),base=copy(x.L.find('t')),busy=plans(ago(40),ago(-10));x.tables.tasks.push({...base,_id:'busy','计划开始时间':busy['计划开始时间'].date,'计划截止时间':busy['计划截止时间'].date});await x.store.read();
 await x.L.saveTaskSchedule('t',plans(ago(25),ago(10)),base,{present:async()=> 'next'});A.equal(x.L.find('t')['任务状态'],C.STATUS[0]);A.ok(x.L.find('t')['计划开始时间']>=busy['计划截止时间'].date);
});
test('rapid past then future moves follow the confirmed native status timestamp',async()=>{
 const x=await fixture(),base=copy(x.L.find('t'));let release;const gate=new Promise(r=>release=r);x.db.beforeWrite=()=>gate;
 x.db.transitionStatus=async p=>{const row=x.tables.tasks[0];A.equal(p.expectedVersion,row._version);row['任务状态']=p.status;row['状态开始时间']=new Date(Date.now()+500).toISOString();row['任务进度']=p.status==='完成'?100:0;row._version++;return {task:copy(row)};};
 const first=x.L.saveTaskSchedule('t',plans(ago(40),ago(10)),base);await new Promise(setImmediate);A.equal(x.L.find('t')['任务状态'],'完成');
 const future=plans(ago(-30),ago(-60)),second=x.L.saveTaskSchedule('t',future,copy(x.L.find('t')));await new Promise(setImmediate);A.equal(x.L.find('t')['任务状态'],C.STATUS[0]);release();await Promise.all([first,second]);A.equal(x.tables.tasks[0]['任务状态'],C.STATUS[0]);A.equal(x.tables.tasks[0]['计划开始时间'],future['计划开始时间'].date);
});
