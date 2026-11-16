'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const C=require('../../src/lite/core.js'),Store=require('../../src/lite/store.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function setup({running=false,child=false}={}){
 const at=new Date(Date.now()-3600000).toISOString(),rows=Object.fromEntries(Object.keys(Store.IDS).map(k=>[k,[]]));
 rows.tasks=[{_id:'task',_version:1,'任务标题':'即时安排','任务状态':running?'进行中':'暂停','状态开始时间':at,'任务类型':'主任务','计划开始时间':'2026-10-27T09:00:00Z','计划截止时间':'2026-10-27T10:00:00Z','回收站':false}];
 if(child)rows.tasks.push({...rows.tasks[0],_id:'child','任务标题':'子任务','任务类型':'子任务','父任务ID':'task'});
 const gate=deferred(),entered=deferred(),writes=[];let seq=0,fail=false,hold=true;
 const key=id=>Object.keys(Store.IDS).find(k=>Store.IDS[k]===id);
 const db={kind:'sites',query:async p=>({results:clone(rows[key(p.databaseId)]),hasMore:false}),getRecord:async p=>clone(rows[key(p.databaseId)].find(r=>r._id===p.recordId)),
  async updateRecord(p){writes.push(p);if(hold){hold=false;entered.resolve();await gate.promise;}if(fail)throw Error('保存失败');const row=rows[key(p.databaseId)].find(r=>r._id===p.recordId);A.equal(p.expectedVersion,row._version);Object.assign(row,Object.fromEntries(Object.entries(p.properties).map(([k,v])=>[k,C.value(v)])));row._version++;return clone(row);},
  async addRecord(p){const row={_id:'log-'+(++seq),_version:1,...Object.fromEntries(Object.entries(p.properties).map(([k,v])=>[k,C.value(v)]))};rows[key(p.databaseId)].push(row);return clone(row);}
 };
 const store=Store.createStore(db);await store.read();return{store,rows,gate,entered,writes,fail(){fail=true;}};
}
const plan=time=>({'计划开始时间':{date:'2026-10-27T'+time+':00Z'}});
test('optimistic schedule is visible before the deferred transport finishes',async()=>{
 const x=await setup(),base=x.store.get('tasks','task'),p=x.store.patch('tasks','task',plan('11:00'),base,{optimistic:true});
 A.equal(x.store.get('tasks','task')['计划开始时间'],'2026-10-27T11:00:00Z');
 A.equal(x.store.data.tasks[0]['计划开始时间'],'2026-10-27T11:00:00Z');
 A.equal(x.rows.tasks[0]['计划开始时间'],'2026-10-27T09:00:00Z');await x.entered.promise;x.gate.resolve();await p;
 A.equal(x.store.get('tasks','task')._version,2);
});
test('an earlier response cannot overwrite a newer queued drag',async()=>{
 const x=await setup(),p1=x.store.patch('tasks','task',plan('11:00'),x.store.get('tasks','task'),{optimistic:true});
 await x.entered.promise;const p2=x.store.patch('tasks','task',plan('12:00'),x.store.get('tasks','task'),{optimistic:true});
 const displayed=[];x.store.subscribe(()=>displayed.push(x.store.get('tasks','task')['计划开始时间']));x.gate.resolve();await Promise.all([p1,p2]);
 A.ok(displayed.every(v=>v==='2026-10-27T12:00:00Z'));A.equal(x.rows.tasks[0]['计划开始时间'],'2026-10-27T12:00:00Z');A.equal(x.writes.length,2);
});
test('failed optimistic save rolls back to confirmed values',async()=>{
 const x=await setup();x.fail();const p=x.store.patch('tasks','task',plan('11:00'),x.store.get('tasks','task'),{optimistic:true});await x.entered.promise;
 A.equal(x.store.get('tasks','task')['计划开始时间'],'2026-10-27T11:00:00Z');x.gate.resolve();await A.rejects(p,/保存失败/);
 A.equal(x.store.get('tasks','task')['计划开始时间'],'2026-10-27T09:00:00Z');A.match(x.store.state.writeError,/保存失败/);
});
test('trash and undo both project immediately while the first write remains pending',async()=>{
 const x=await setup({child:true}),trash=x.store.trashTask('task');A.ok(x.store.data.tasks.every(t=>t['回收站']));
 await x.entered.promise;const undo=x.store.restoreTask('task');A.ok(x.store.data.tasks.every(t=>!t['回收站']));x.gate.resolve();await Promise.all([trash,undo]);
 A.ok(x.rows.tasks.every(t=>!t['回收站']));
});
test('drag trash pauses running descendants and preserves both time logs',async()=>{
 const x=await setup({running:true,child:true}),p=x.store.trashTask('task',false,{pauseRunning:true});
 A.ok(x.store.data.tasks.every(t=>t['回收站']));await x.entered.promise;x.gate.resolve();await p;
 A.ok(x.rows.tasks.every(t=>t['回收站']&&t['任务状态']==='暂停'));A.equal(x.rows.logs.length,2);A.ok(x.rows.logs.every(log=>log['状态']==='进行中'&&log['结束时间']));
});
test('status rail changes state immediately while preserving actual log write',async()=>{
 const x=await setup({running:true}),base=x.store.get('tasks','task'),p=x.store.setStatus('task','暂停',new Date().toISOString(),base);
 A.equal(x.store.get('tasks','task')['任务状态'],'暂停');await x.entered.promise;x.gate.resolve();await p;A.equal(x.rows.logs.length,1);
});
test('queued Sites status changes use the confirmed server timestamp of the preceding local change',async()=>{
 const now=Date.now(),gate=deferred(),entered=deferred(),calls=[],logs=[];
 let row={_id:'task',_version:1,'任务标题':'快速切换状态','任务状态':'暂停','状态开始时间':new Date(now-3600000).toISOString(),'回收站':false};
 const db={kind:'sites',query:async p=>({results:p.databaseId===Store.IDS.tasks?[clone(row)]:[],hasMore:false}),getRecord:async()=>clone(row),
  async transitionStatus(p){calls.push(p);if(calls.length===1){entered.resolve();await gate.promise;}A.equal(p.expectedVersion,row._version);
   const at=new Date(now+calls.length*1000).toISOString(),log={_id:'log-'+calls.length,_version:1,'任务ID':'task','状态':row['任务状态'],'开始时间':row['状态开始时间'],'结束时间':at};
   logs.push(log);row={...row,_version:row._version+1,'任务状态':p.status,'状态开始时间':at,'状态结束时间':null};return{task:clone(row),log:clone(log)};
  }
 };
 const store=Store.createStore(db);await store.read();
 const start=store.setStatus('task','进行中',new Date(now).toISOString(),store.get('tasks','task'));await entered.promise;
 const pause=store.setStatus('task','暂停',new Date(now+10).toISOString(),store.get('tasks','task'));
 A.equal(store.get('tasks','task')['任务状态'],'暂停');gate.resolve();
 const results=await Promise.allSettled([start,pause]);A.deepEqual(results.map(result=>result.status),['fulfilled','fulfilled']);
 A.equal(calls.length,2);A.equal(row['任务状态'],'暂停');A.equal(store.get('tasks','task')['任务状态'],'暂停');
 A.equal(store.get('tasks','task')['状态开始时间'],new Date(now+2000).toISOString());A.equal(logs.length,2);A.equal(store.data.logs.length,2);
});
