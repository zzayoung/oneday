const test=require('node:test');
const assert=require('node:assert/strict');
const Cloud=require('../../src/lite/cloud.js');
const Store=require('../../src/lite/store.js');
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const tables=()=>Object.fromEntries(Object.keys(Cloud.IDS).map(k=>[k,[]]));

test('inconsistent legacy ID aliases are rejected before import can break relations',async()=>{
 const backup={tables:tables()};backup.tables.tasks=[{_id:'legacy-A',id:'legacy-B','任务标题':'原任务'}];backup.tables.notes=[{_id:'note','关联任务ID':'legacy-B'}];let calls=0;
 const db=Cloud.createDatabase({origin:'https://oneday.test',fetch:async()=>{calls++;return response({tables:tables()});}});
 await assert.rejects(db.previewImport(backup),/ID.*不一致/);assert.equal(calls,0);
 backup.tables.tasks[0].id='legacy-A';const prepared=Cloud.validateBackup(backup);assert.equal(prepared.tables.tasks[0]._id,'legacy-A');assert.equal(prepared.tables.tasks[0].id,undefined);
});

test('large backup falls back to complete record and attachment pages at one revision',async()=>{
 let revisionCalls=0;
 const db=Cloud.createDatabase({origin:'https://oneday.test',fetch:async url=>{
  const u=new URL(url),p=u.pathname;
  if(p.endsWith('/backup'))return response({error:'large',code:'BACKUP_TOO_LARGE'},413);
  if(p.endsWith('/revision')){revisionCalls++;return response({revision:'42'});}
  if(p.endsWith('/records/tasks'))return response(u.searchParams.has('cursor')?{results:[{_id:'b','任务标题':'第二页'}],hasMore:false,nextCursor:null}:{results:[{_id:'a','任务标题':'第一页'}],hasMore:true,nextCursor:'next'});
  if(p.endsWith('/files'))return response(u.searchParams.has('cursor')?{results:[{id:'f2',url:'/api/oneday/files/f2'}],hasMore:false}:{results:[{id:'f1',url:'/api/oneday/files/f1'}],hasMore:true,nextCursor:'files-next'});
  return response({results:[],hasMore:false});
 }});
 const backup=await db.exportBackup();assert.equal(backup.tables.tasks.length,2);assert.equal(Object.keys(backup.tables).length,7);assert.equal(backup.attachments.length,2);assert.equal(backup.revision,'42');assert.equal(backup.attachmentBytesIncluded,false);assert.equal(revisionCalls,2);
});

test('large backup retries a moving snapshot and never returns mixed pages',async()=>{
 let revisionCalls=0,round=0;
 const db=Cloud.createDatabase({origin:'https://oneday.test',fetch:async url=>{
  const p=new URL(url).pathname;
  if(p.endsWith('/backup'))return response({error:'large'},413);
  if(p.endsWith('/revision')){revisionCalls++;if(revisionCalls===1)round=1;if(revisionCalls===3)round=2;return response({revision:revisionCalls===1?'1':'2'});}
  return response({results:p.endsWith('/records/tasks')?[{_id:'t',round}]:[],hasMore:false});
 }});
 const backup=await db.exportBackup();assert.equal(backup.tables.tasks[0].round,2);assert.equal(backup.revision,'2');assert.equal(revisionCalls,4);
});

test('large backup refuses an incomplete cursor instead of producing a partial export',async()=>{
 const db=Cloud.createDatabase({origin:'https://oneday.test',fetch:async url=>{
  const p=new URL(url).pathname;
  if(p.endsWith('/backup'))return response({error:'large'},413);
  if(p.endsWith('/revision'))return response({revision:'1'});
  return response(p.endsWith('/records/tasks')?{results:[{_id:'t'}],hasMore:true}:{results:[],hasMore:false});
 }});
 await assert.rejects(db.exportBackup(),/分页/);
});

test('import batches by UTF-8 bytes as well as row count',async()=>{
 const backup={tables:tables()},requests=[];backup.tables.notes=Array.from({length:32},(_,i)=>({_id:'n'+i,'便签内容':'中'.repeat(100000)}));
 const db=Cloud.createDatabase({origin:'https://oneday.test',fetch:async(url,opts)=>{
  if(url.endsWith('/backup'))return response({tables:tables()});
  const payload=JSON.parse(opts.body);requests.push(opts.body);return response({imported:Object.values(payload.tables).flat().length,skipped:0});
 }});
 const result=await db.importBackup(backup);assert.equal(result.imported,32);assert.ok(requests.length>=2);for(const body of requests)assert.ok(Buffer.byteLength(body)<8*1024*1024);
});

test('Sites store reads beyond the old 50-page ceiling without truncation',async()=>{
 let maxPage=0;
 const db={kind:'sites',query:async({databaseId,startCursor})=>{
  if(databaseId!==Cloud.IDS.tasks)return{results:[],hasMore:false};
  const page=Number(startCursor||0);maxPage=Math.max(maxPage,page);return{results:[{_id:'t'+page}],hasMore:page<50,nextCursor:String(page+1)};
 }};
 const store=Store.createStore(db);await store.read();assert.equal(store.data.tasks.length,51);assert.equal(maxPage,50);
});
