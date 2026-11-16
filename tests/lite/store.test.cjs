const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const file=path.join(__dirname,'../../src/lite/store.js');const API=fs.existsSync(file)?require(file):{};
const IDS={tasks:'oneday-tasks',logs:'oneday-logs',tags:'oneday-tags',links:'oneday-links',notes:'oneday-notes',sets:'oneday-sets',cal:'oneday-cal'};
function setup(taskFields){let seq=0,fail='',calls=[],active=0,peak=0;const D=Object.fromEntries(Object.values(IDS).map(k=>[k,[]]));const db={taskFields:taskFields||[],query:async p=>{if(fail==='read'||fail===p.databaseId)throw Error('offline');return {results:structuredClone(D[p.databaseId]),hasMore:false};},onUpdated:f=>{},addRecord:async p=>{calls.push(['add',p]);if(fail==='write'||fail===p.databaseId||(fail==='logwrite'&&p.databaseId===IDS.logs))throw Error('denied');const id='new-'+(++seq);let r={_id:id};for(const[k,v]of Object.entries(p.properties))r[k]=v[Object.keys(v)[0]];D[p.databaseId].push(r);return {id};},updateRecord:async p=>{calls.push(['update',p]);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;if(fail==='write'||fail===p.databaseId||(fail==='logwrite'&&p.databaseId===IDS.logs))throw Error('denied');const r=D[p.databaseId].find(r=>r._id===p.recordId);if(!r)throw Error('missing');for(const[k,v]of Object.entries(p.properties))r[k]=v[Object.keys(v)[0]];return {id:r._id};},deleteRecord:async p=>{if(fail==='write')throw Error('denied');D[p.databaseId]=D[p.databaseId].filter(r=>r._id!==p.recordId);return {};}};return {D,db,calls,store:API.createStore?API.createStore(db):null,fail:v=>fail=v,peak:()=>peak};}
const task={_id:'t','任务标题':'任务','任务状态':'进行中','状态开始时间':'2026-09-20T09:00:00Z','创建时间':'2026-09-20T08:00:00Z','任务类型':'主任务','任务详情':'旧内容','计划开始时间':'2026-09-22T14:15:00Z'};
const seed=async x=>{x.D[IDS.tasks].push({...task});await x.store.read();};
test('Lite store factory exists',()=>A.equal(typeof API.createStore,'function'));
test('read returns seven tables, ids preserved',async()=>{let x=setup();await seed(x);A.equal(Object.keys(x.store.data).length,7);A.equal(x.store.data.tasks[0]._id,'t')});
test('any failed table read keeps previous full snapshot',async()=>{let x=setup();await seed(x);x.D[IDS.tasks][0]['任务标题']='changed';x.fail(IDS.logs);await A.rejects(x.store.read(),/offline/);A.equal(x.store.data.tasks[0]['任务标题'],'任务')});
test('title-only update never rewrites exact plan',async()=>{let x=setup();await seed(x);await x.store.patch('tasks','t',{'任务标题':{text:'新'}},{...task});let p=x.calls.at(-1)[1].properties;A.deepEqual(Object.keys(p),['任务标题']);A.equal(x.D[IDS.tasks][0]['计划开始时间'],task['计划开始时间'])});
test('conflict on same field rejects before writing',async()=>{let x=setup();await seed(x);x.D[IDS.tasks][0]['任务详情']='other';await A.rejects(x.store.patch('tasks','t',{'任务详情':{text:'mine'}},task),/其他设备/);A.equal(x.calls.length,0)});
test('unrelated remote changes allow narrow patch',async()=>{let x=setup();await seed(x);x.D[IDS.tasks][0]['任务详情']='other';await x.store.patch('tasks','t',{'任务标题':{text:'mine'}},task);A.equal(x.D[IDS.tasks][0]['任务详情'],'other')});
test('note body conflicts protected too',async()=>{let x=setup(),n={_id:'n','便签内容':'old'};x.D[IDS.notes].push(n);await x.store.read();x.D[IDS.notes][0]['便签内容']='remote';await A.rejects(x.store.patch('notes','n',{'便签内容':{text:'local'}},{'便签内容':'old'}),/其他设备/)});
test('write failure is rejected and not auto retried',async()=>{let x=setup();await seed(x);x.fail('write');await A.rejects(x.store.patch('tasks','t',{'任务标题':{text:'x'}},task),/denied/);A.equal(x.calls.length,1);A.equal(x.store.data.tasks[0]['任务标题'],'任务')});
test('queue serializes separate local edits',async()=>{let x=setup();await seed(x);await Promise.all([x.store.patch('tasks','t',{'任务标题':{text:'one'}},task),x.store.patch('tasks','t',{'任务详情':{text:'two'}},task)]);A.equal(x.peak(),1)});
test('explicit typed null plan clearing preserved',async()=>{let x=setup();await seed(x);await x.store.patch('tasks','t',{'计划开始时间':{date:null}},task);A.equal(x.D[IDS.tasks][0]['计划开始时间'],null)});
test('status pause writes history in original hours unit',async()=>{let x=setup();await seed(x);await x.store.setStatus('t','暂停','2026-09-20T10:30:00Z',task);A.equal(x.D[IDS.tasks][0]['任务状态'],'暂停');const l=x.D[IDS.logs][0];A.equal(l['持续时长'],1.5);A.equal(l['状态'],'进行中')});
test('repeated status command does not duplicate log',async()=>{let x=setup();await seed(x);await x.store.setStatus('t','暂停','2026-09-20T10:30:00Z',task);await x.store.setStatus('t','暂停','2026-09-20T10:31:00Z');A.equal(x.D[IDS.logs].length,1)});
test('close matching legacy open log instead of add duplicate',async()=>{let x=setup();await seed(x);x.D[IDS.logs].push({_id:'open','任务ID':'t','状态':'进行中','开始时间':task['状态开始时间']});await x.store.setStatus('t','完成','2026-09-20T10:00:00Z',task);A.equal(x.D[IDS.logs].length,1);A.equal(x.D[IDS.logs][0]['结束时间'],'2026-09-20T10:00:00.000Z')});
test('log preflight failure prevents status mutation',async()=>{let x=setup();await seed(x);x.fail(IDS.logs);await A.rejects(x.store.setStatus('t','暂停','2026-09-20T10:00:00Z',task),/offline/);A.equal(x.D[IDS.tasks][0]['任务状态'],'进行中');/* preflight fails, therefore no state mutation */});
test('completed to doing clears stale progress and state end',async()=>{let x=setup();await seed(x);x.D[IDS.tasks][0]['任务状态']='完成';x.D[IDS.tasks][0]['任务进度']=100;await x.store.read();await x.store.setStatus('t','进行中','2026-09-20T11:00:00Z');A.equal(x.D[IDS.tasks][0]['任务进度'],0);A.equal(x.D[IDS.tasks][0]['状态结束时间'],null)});
test('new task title empty rejected',async()=>{let x=setup();await A.rejects(x.store.createTask({title:' '}),/标题/)});
test('create task without date stays unscheduled',async()=>{let x=setup();await x.store.read();let r=await x.store.createTask({title:'点子'});A.equal(r['任务状态'],'收集（未开始）');A.ok(!r['计划开始时间'])});
test('append progress creates linked note not task body overwrite',async()=>{let x=setup();await seed(x);let r=await x.store.addWorklog('t','已完成初稿');A.equal(r['关联任务ID'],'t');A.equal(r['便签分类'],'记录');A.equal(x.D[IDS.tasks][0]['任务详情'],'旧内容')});
test('note conversion preserves original and links once',async()=>{let x=setup();x.D[IDS.notes].push({_id:'n','便签内容':'一个点子\n第二行','便签分类':'灵感'});await x.store.read();let r=await x.store.convertNote('n');A.equal(x.D[IDS.notes].length,1);A.equal(x.D[IDS.notes][0]['关联任务ID'],r._id);await x.store.convertNote('n');A.equal(x.D[IDS.tasks].length,1)});
test('recycling task refuses while a descendant running',async()=>{let x=setup();await seed(x);await A.rejects(x.store.trashTask('t'),/暂停/)});
test('backup retains unknown fields from all tables',async()=>{let x=setup();await seed(x);x.D[IDS.tasks][0]['自定义字段']='kept';await x.store.read();A.equal(x.store.backup().tables.tasks[0]['自定义字段'],'kept')});

test("log write failure reports saved state and recoverable segment",async()=>{let x=setup();await seed(x);x.fail("logwrite");await A.rejects(x.store.setStatus("t","暂停","2026-09-20T10:00:00Z",task),e=>e.partial&&!!e.lostSegment);A.equal(x.D[IDS.tasks][0]["任务状态"],"暂停");A.equal(x.D[IDS.logs].length,0)});


test('old task rows remain readable when 1.3 fields are absent',async()=>{
 let x=setup();await seed(x);A.equal(x.store.schemaHasTaskField('允许并行'),false);A.equal(x.store.get('tasks','t')['任务标题'],'任务');
});

test('attribute update writes only explicitly supported new fields',async()=>{
 let x=setup(['最后期限','预计时长','允许并行']);await seed(x);
 await x.store.updateTaskAttributes('t',{deadline:'2026-09-30',estimate:90,parallel:true},x.store.get('tasks','t'));
 const t=x.store.get('tasks','t');A.equal(t['最后期限'],'2026-09-30');A.equal(t['预计时长'],90);A.equal(t['允许并行'],true);
});

test('attribute update rejects when host exposes none of the 1.3 fields',async()=>{
 let x=setup();await seed(x);await A.rejects(x.store.updateTaskAttributes('t',{deadline:'2026-09-30',estimate:90,parallel:true},x.store.get('tasks','t')),/尚未增加 1.3 属性字段/);
});

test('new task persists supported 1.3 attributes only',async()=>{
 let x=setup(['最后期限','预计时长','允许并行']);await x.store.read();
 const r=await x.store.createTask({title:'带属性任务',deadline:'2026-10-01',estimate:45,parallel:true});
 A.equal(r['最后期限'],'2026-10-01');A.equal(r['预计时长'],45);A.equal(r['允许并行'],true);
});
test('partial 1.3 attribute update does not clear sibling attributes',async()=>{
 let x=setup(['最后期限','预计时长','允许并行']);
 x.D[IDS.tasks].push({...task,'最后期限':'2026-09-30','预计时长':90,'允许并行':false});
 await x.store.read();
 const base=x.store.get('tasks','t');
 await x.store.updateTaskAttributes('t',{parallel:true},base);
 const saved=x.store.get('tasks','t');
 A.equal(saved['允许并行'],true);
 A.equal(saved['最后期限'],'2026-09-30');
 A.equal(saved['预计时长'],90);
});
