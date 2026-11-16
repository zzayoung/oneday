/* Integration test against the managed local Worker. Identity fixtures are test headers only. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const Cloud=require('../../src/lite/cloud.js');
const Store=require('../../src/lite/store.js');
const base='http://127.0.0.1:4173';
const owner='local-http-qa-'+crypto.randomUUID();
const client=id=>Cloud.createDatabase({origin:base,fetch:(url,options={})=>fetch(url,{...options,headers:{...options.headers,'oai-authenticated-user-id':id,origin:base}})});
const accountFetch=(id,path,options={})=>fetch(base+path,{...options,headers:{...options.headers,'oai-authenticated-user-id':id,origin:base}});
const steps=[];
async function check(name,fn){await fn();steps.push(name);console.log('PASS '+name);}

await check('Worker health reaches migrated D1 and real local R2',async()=>{const r=await fetch(base+'/api/oneday/health');assert.equal(r.status,200);const j=await r.json();assert.equal(j.database,true);assert.equal(j.files,true);});
await check('unsigned request cannot read task API',async()=>{const r=await fetch(base+'/api/oneday/records/tasks');assert.equal(r.status,401);});
const a=client(owner),b=client(owner),stranger=client(owner+'-other');
const sa=Store.createStore(a),sb=Store.createStore(b);
let task;
await check('client A creates a task in the actual Worker with exact plan and Markdown',async()=>{await sa.read();assert.equal(sa.data.tasks.length,0);task=await sa.createTask({title:'本地集成验证任务',body:'## 表格\n| 项目 | 数量 |\n| --- | --- |\n| 例子 | 2 |',date:'2026-11-01',start:'10:00',end:'10:30'});assert.equal(task._version,1);assert.equal(task['计划开始时间'],'2026-11-01T10:00:00Z');});
await check('independent client B reads persisted task without A memory',async()=>{await sb.read();assert.equal(sb.get('tasks',task._id)['任务详情'],task['任务详情']);});
await check('stale simultaneous update is rejected and first result remains',async()=>{const stale=sb.get('tasks',task._id);await a.updateRecord({databaseId:Cloud.IDS.tasks,recordId:task._id,expectedVersion:stale._version,properties:{'任务标题':{text:'客户端 A 已修改'}}});await assert.rejects(b.updateRecord({databaseId:Cloud.IDS.tasks,recordId:task._id,expectedVersion:stale._version,properties:{'任务标题':{text:'不应覆盖'}}}),e=>e.status===409);assert.equal((await b.getRecord({databaseId:Cloud.IDS.tasks,recordId:task._id}))['任务标题'],'客户端 A 已修改');});
await check('another authenticated identity sees an empty record space',async()=>{assert.equal((await stranger.query({databaseId:Cloud.IDS.tasks})).results.length,0);});
await check('state transition persists task and duration log together',async()=>{await sa.read();await sa.setStatus(task._id,'进行中',new Date().toISOString(),sa.get('tasks',task._id));await sa.setStatus(task._id,'暂停',new Date().toISOString(),sa.get('tasks',task._id));await sb.read();assert.equal(sb.get('tasks',task._id)['任务状态'],'暂停');assert.ok(sb.data.logs.some(l=>l['任务ID']===task._id&&l['状态']==='进行中'));});
let image,file;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
await check('R2 image upload and cross-client download preserve exact bytes',async()=>{image=await a.uploadImage({file:new File([png],'pixel.png',{type:'image/png'}),owner:{type:'task',id:task._id}});const r=await accountFetch(owner,image.url);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);assert.equal(r.headers.get('x-content-type-options'),'nosniff');});
await check('document upload is persisted and downloaded as attachment',async()=>{const text='OneDay storage verification';file=await a.uploadFile({file:new File([text],'verification.txt',{type:'text/plain'})});const r=await accountFetch(owner,file.url);assert.equal(await r.text(),text);assert.match(r.headers.get('content-disposition'),/^attachment;/);});
await check('foreign identity cannot download a known attachment ID',async()=>{assert.equal((await accountFetch(owner+'-other',image.url)).status,404);});
await check('server backup contains all seven tables and attachment manifest',async()=>{const backup=await b.exportBackup();for(const key of Object.keys(Cloud.IDS))assert.ok(Array.isArray(backup.tables[key]));assert.equal(backup.attachments.length,2);assert.equal(backup.tables.tasks.length,1);});
await check('reimport skips identical IDs and blocks changed data',async()=>{const backup=await b.exportBackup();const ok=await a.importBackup(backup);assert.equal(ok.imported,0);assert.ok(ok.skipped>=1);backup.tables.tasks[0]['任务标题']='同 ID 不同内容';const preview=await a.previewImport(backup);assert.equal(preview.conflicts.length,1);await assert.rejects(a.importBackup(backup),/已停止导入/);});
console.log(JSON.stringify({result:'passed',checks:steps.length,scope:'isolated local Worker using test identity headers; not real browser sign-in'}));
