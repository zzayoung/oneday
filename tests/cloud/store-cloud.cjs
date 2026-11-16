const test=require('node:test');
const assert=require('node:assert/strict');
const Store=require('../../src/lite/store.js');
const task={_id:'t',_version:4,'任务标题':'原任务','任务状态':'收集（未开始）','状态开始时间':'2026-01-01T00:00:00Z','回收站':false};
test('cloud patch uses a single-record read and forwards its actual CAS version',async()=>{
 let scans=0,gets=0,received;
 const db={query:async()=>{scans++;return{results:[task],hasMore:false};},getRecord:async()=>{gets++;return task;},updateRecord:async args=>{received=args;return {...task,_version:5,'任务标题':'新标题'};}};
 const store=Store.createStore(db);const row=await store.patch('tasks','t',{'任务标题':{text:'新标题'}},task);
 assert.equal(scans,0);assert.equal(gets,1);assert.equal(received.expectedVersion,4);assert.equal(row._version,5);
});
test('cloud status delegates task and time-log persistence to one atomic server operation',async()=>{
 let atomic=0,legacyWrites=0;
 const changed={...task,_version:5,'任务状态':'进行中'};
 const db={query:async()=>({results:[task],hasMore:false}),getRecord:async()=>task,transitionStatus:async args=>{atomic++;assert.equal(args.expectedVersion,4);return{task:changed,log:null};},updateRecord:async()=>{legacyWrites++;},addRecord:async()=>{legacyWrites++;return{_id:'x'};}};
 const store=Store.createStore(db);await store.setStatus('t','进行中',new Date().toISOString(),task);
 assert.equal(atomic,1);assert.equal(legacyWrites,0);assert.equal(store.get('tasks','t')._version,5);
});
test('only explicit correction forwards the user-selected past ending instant',async()=>{
 const running={...task,'任务状态':'进行中'},seen=[],end='2026-01-01T01:30:00.000Z';
 const db={kind:'sites',getRecord:async()=>running,transitionStatus:async args=>{seen.push(args);return{task:{...running,'任务状态':'暂停'},log:null};}};
 const store=Store.createStore(db);await store.setStatus('t','暂停',end,running,{corrected:true});await store.setStatus('t','暂停',new Date().toISOString(),running);
 assert.equal(seen[0].endedAt,end);assert.equal(seen[1].endedAt,undefined);
});
test('manual correction cannot report success after another device already paused the segment',async()=>{
 const expected={...task,'任务状态':'进行中'},paused={...expected,_version:5,'任务状态':'暂停','状态开始时间':'2026-01-01T03:00:00.000Z'};let writes=0;
 const db={kind:'sites',getRecord:async()=>paused,transitionStatus:async()=>{writes++;return{task:paused,log:null};}};
 const store=Store.createStore(db);await assert.rejects(store.setStatus('t','暂停','2026-01-01T01:30:00.000Z',expected,{corrected:true}),/已|计时/);assert.equal(writes,0);
});
