/* Lite data repository. Same seven table keys and original WorkBuddy compatibility.
   Sites adds server versions and atomic task/log status changes through its SDK bridge. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.OneDayLiteStore=factory(root.OneDayLiteCore);})(typeof window!=='undefined'?window:this,function(C){
'use strict';
const IDS={tasks:'oneday-tasks',logs:'oneday-logs',tags:'oneday-tags',links:'oneday-links',notes:'oneday-notes',sets:'oneday-sets',cal:'oneday-cal'};
const copy=o=>JSON.parse(JSON.stringify(o));
function partial(message,extra={}){const e=Error(message);e.partial=true;Object.assign(e,extra);return e;}
function createStore(db){
 let data=Object.fromEntries(Object.keys(IDS).map(k=>[k,[]])),chain=Promise.resolve(),reading=null,revision=0,listeners=[],conversions={};
 const pendingEdits=[],statusFlights=new Map();
 const declaredTaskFields=(db&&Array.isArray(db.taskFields)?db.taskFields:(db&&db.capabilities&&Array.isArray(db.capabilities.taskFields)?db.capabilities.taskFields:[]));
 const capabilities={taskFields:new Set(declaredTaskFields)};
 const schemaHasTaskField=name=>capabilities.taskFields.has(name);
 const state={connected:!!db,loading:false,loaded:false,pending:0,lastRead:0,lastWrite:0,readError:'',writeError:'',pendingSince:0};
 const emit=()=>listeners.forEach(f=>{try{f(state);}catch(e){console.error(e);}});
 // WorkBuddy's source checker in the supplied handoff requires db and literal databaseId.
 function query(key,cursor){const args={pageSize:200,startCursor:cursor};switch(key){
  case'tasks':return db.query({databaseId:'oneday-tasks',...args});case'logs':return db.query({databaseId:'oneday-logs',...args});
  case'tags':return db.query({databaseId:'oneday-tags',...args});case'links':return db.query({databaseId:'oneday-links',...args});
  case'notes':return db.query({databaseId:'oneday-notes',...args});case'sets':return db.query({databaseId:'oneday-sets',...args});case'cal':return db.query({databaseId:'oneday-cal',...args});default:throw Error('未知数据表');}}
 function send(op,key,args){if(!db)throw Error('尚未连接 WorkBuddy 数据环境');switch(op){
case 'addRecord':switch(key){
case 'tasks':return db.addRecord({databaseId:'oneday-tasks',...args});
case 'logs':return db.addRecord({databaseId:'oneday-logs',...args});
case 'tags':return db.addRecord({databaseId:'oneday-tags',...args});
case 'links':return db.addRecord({databaseId:'oneday-links',...args});
case 'notes':return db.addRecord({databaseId:'oneday-notes',...args});
case 'sets':return db.addRecord({databaseId:'oneday-sets',...args});
case 'cal':return db.addRecord({databaseId:'oneday-cal',...args});
}break;
case 'updateRecord':switch(key){
case 'tasks':return db.updateRecord({databaseId:'oneday-tasks',...args});
case 'logs':return db.updateRecord({databaseId:'oneday-logs',...args});
case 'tags':return db.updateRecord({databaseId:'oneday-tags',...args});
case 'links':return db.updateRecord({databaseId:'oneday-links',...args});
case 'notes':return db.updateRecord({databaseId:'oneday-notes',...args});
case 'sets':return db.updateRecord({databaseId:'oneday-sets',...args});
case 'cal':return db.updateRecord({databaseId:'oneday-cal',...args});
}break;
case 'deleteRecord':switch(key){
case 'tasks':return db.deleteRecord({databaseId:'oneday-tasks',...args});
case 'logs':return db.deleteRecord({databaseId:'oneday-logs',...args});
case 'tags':return db.deleteRecord({databaseId:'oneday-tags',...args});
case 'links':return db.deleteRecord({databaseId:'oneday-links',...args});
case 'notes':return db.deleteRecord({databaseId:'oneday-notes',...args});
case 'sets':return db.deleteRecord({databaseId:'oneday-sets',...args});
case 'cal':return db.deleteRecord({databaseId:'oneday-cal',...args});
}break;
}throw Error('未知数据操作或数据表');}
 async function all(key){if(!db)throw Error('尚未连接 WorkBuddy 数据环境');let out=[],cursor;const seen=new Set(),maxPages=db.kind==='sites'?100000:50;for(let page=0;page<maxPages;page++){
  let timer;const res=await Promise.race([query(key,cursor),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('读取超时，请检查网络')),15000);})]).finally(()=>clearTimeout(timer));
  if(!res||!Array.isArray(res.results))throw Error('数据接口返回结构异常');out.push(...res.results.map(r=>({...r,_id:C.id(r)})));
  if(db.kind==='sites'&&out.length>100000)throw Error('记录超过当前 10 万条安全上限，保留上次完整数据');if(!res.hasMore)return out;if(!res.nextCursor||seen.has(res.nextCursor)||res.nextCursor===cursor||!res.results.length)throw Error('分页游标异常，保留上次数据');cursor=res.nextCursor;seen.add(cursor);
 }throw Error('记录超过当前分页安全上限，请检查数据');}
 function read(){if(reading)return reading;state.loading=true;emit();reading=(async()=>{await chain;
  for(let attempt=0;attempt<4;attempt++){const epoch=revision,remoteEpoch=typeof db.snapshotVersion==='function'?await db.snapshotVersion():null,keys=Object.keys(IDS),rows=await Promise.all(keys.map(all));if(epoch!==revision){await chain;continue;}if(remoteEpoch!==null&&remoteEpoch!==await db.snapshotVersion())continue;data=Object.fromEntries(keys.map((k,i)=>[k,rows[i]]));state.loaded=true;state.lastRead=Date.now();state.readError='';db.didRead?.(remoteEpoch);return data;}throw Error('数据正在持续更新，请稍后重新读取');
 })().catch(e=>{state.readError=e.message;throw e;}).finally(()=>{state.loading=false;reading=null;emit();});return reading;}
 function enqueue(work){state.pending++;if(state.pending===1)state.pendingSince=Date.now();emit();const p=chain.then(async()=>{if(!db)throw Error('尚未连接资料库，未保存');return work();});chain=p.catch(()=>{});p.then(()=>{state.lastWrite=Date.now();state.writeError='';},e=>{state.writeError=e.message;}).finally(()=>{state.pending--;emit();});return p;}
 function visible(key,row){if(!row)return row;let result=row;for(const batch of pendingEdits)for(const edit of batch)if(edit.key===key&&edit.id===C.id(row))result={...result,...edit.fields};return result;}
 const get=(key,id)=>visible(key,data[key].find(r=>C.id(r)===id));
 const values=props=>Object.fromEntries(Object.entries(props).map(([k,v])=>[k,C.value(v)]));
 // Pending gestures are a view over confirmed rows. A prior response cannot erase a newer move.
 function optimisticWrite(edits,work){pendingEdits.push(edits);return enqueue(work).finally(()=>{pendingEdits.splice(pendingEdits.indexOf(edits),1);emit();});}
 function local(key,row){const i=data[key].findIndex(r=>C.id(r)===C.id(row));if(i>=0)data[key][i]=copy(row);else data[key].push(copy(row));revision++;emit();return copy(row);}
 async function addRaw(key,props,options={}){const r=await send('addRecord',key,{...options,properties:props}),id=C.id(r);if(!id)throw partial('新增已提交，但服务端未返回记录 ID。请重新读取核对，不要重复提交。');return local(key,{_id:id,...values(props),...(db.kind==='sites'?r:{})});}
 async function updateRaw(key,id,props,row){const base=row||get(key,id),r=await send('updateRecord',key,{recordId:id,properties:props,...(base?._version!==undefined?{expectedVersion:base._version}:{})});return local(key,{...base,_id:id,...values(props),...(r?._version!==undefined?r:{})});}
 async function fresh(key,id){const r=typeof db.getRecord==='function'?await db.getRecord({databaseId:IDS[key],recordId:id}):(await all(key)).find(r=>C.id(r)===id);if(!r)throw Error('记录已不存在，请刷新核对');return r;}
 function check(row,props,base,key,guardFields=[]){if(key==='tasks'&&row['回收站']&&!(props['回收站']&&props['回收站'].checkbox===false))throw Error('任务已在回收站，请先恢复');if(!base)return;const conflicts=[...new Set([...Object.keys(props).filter(k=>!C.same(row[k],base[k])&&!C.same(row[k],C.value(props[k]))),...guardFields.filter(k=>!C.same(row[k],base[k]))])];if(conflicts.length)throw Error('其他设备已修改 '+conflicts.join('、')+'。未覆盖；请保留草稿后重新读取。');}
 async function patchRaw(key,id,props,base,guardFields=[]){const row=await fresh(key,id);check(row,props,base,key,guardFields);return updateRaw(key,id,props,row);}
 function patch(key,id,props,base,options={}){
  let expected=copy(base||get(key,id)||{});const guardFields=options.guardFields?[...options.guardFields]:[],after=options.statusAfter;
  if(!after){const work=()=>patchRaw(key,id,props,expected,guardFields);return options.optimistic?optimisticWrite([{key,id,fields:values(props)}],work):enqueue(work);}
  if(key!=='tasks'||!C.STATUS.includes(after.next))return Promise.reject(Error('未知任务状态'));
  const fields=statusFields(id,after.next,after.at),previous=statusFlights.get(id),follows=previous&&expected['任务状态']===previous.fields['任务状态']&&C.same(expected['状态开始时间'],previous.fields['状态开始时间']);
  const entry={fields,promise:optimisticWrite([{key,id,fields:{...values(props),...fields}}],async()=>{
   // A second drag can follow an optimistic status change before its server timestamp arrives.
   if(follows){const confirmed=await previous.promise;expected={...expected,'任务状态':confirmed['任务状态'],'状态开始时间':confirmed['状态开始时间']};}
   const saved=await patchRaw(key,id,props,expected,[...guardFields,'任务状态','状态开始时间']);
   try{return await transitionRaw(id,after.next,after.at,saved,{guardFields});}
   catch(error){if(error.partial)throw error;throw partial('计划已保存，但自动状态未同步：'+error.message+'。请重新读取后调整状态。',{scheduledTask:saved});}
  })};statusFlights.set(id,entry);
  return entry.promise.finally(()=>{if(statusFlights.get(id)===entry)statusFlights.delete(id);});
 }
 function taskProperties(o){const title=String(o.title||'').trim();if(!title||title.length>300)throw Error('任务标题需为 1–300 个字');const now=new Date().toISOString();let props={'任务标题':{text:title},'任务类型':{select:o.parent?'子任务':'主任务'},'任务状态':{select:C.STATUS[0]},'状态开始时间':{date:now},'创建时间':{date:now},'任务详情':{text:o.body||''},'回收站':{checkbox:false}};
  if(o.parent)props['父任务ID']={text:o.parent};
  if(o.priority)props['优先级']={select:o.priority};if(o.date){if(!C.validDate(o.date))throw Error('计划日期无效');props['计划开始时间']={date:o.date+'T'+(o.start||'00:00')+':00Z'};props['计划截止时间']={date:(o.endDate||o.date)+'T'+(o.end||'23:59')+':00Z'};}
  if(schemaHasTaskField('最后期限')&&o.deadline!==undefined)props['最后期限']={date:o.deadline||null};
  if(schemaHasTaskField('预计时长')&&o.estimate!==undefined)props['预计时长']={number:o.estimate?Number(o.estimate):null};
  if(schemaHasTaskField('允许并行')&&o.parallel!==undefined)props['允许并行']={checkbox:!!o.parallel};
  return props;
 }
 async function finishTaskCreation(t,o){try{for(const tag of o.tags||[])await addTagLink(C.id(t),tag);}catch(e){throw partial('任务已创建，但标签未全部保存：'+e.message,{createdTask:C.id(t)});}return t;}
 async function createRaw(o,options={}){const props=taskProperties(o);if(o.parent){const parent=await fresh('tasks',o.parent);if(parent['回收站'])throw Error('父任务已在回收站');}const extra=options.intent&&typeof db.getPendingCreate==='function'?{intentProperties:taskProperties(options.intent)}:{};return finishTaskCreation(await addRaw('tasks',props,extra),o);}
 function resumeTaskCreation(o){if(typeof db?.getPendingCreate!=='function')return Promise.resolve(null);const input=copy(o);return enqueue(async()=>{const pending=await db.getPendingCreate({databaseId:IDS.tasks,properties:taskProperties(input)});if(!pending)return null;return finishTaskCreation(await addRaw('tasks',pending.properties),input);});}
 async function updateTaskAttributes(tid,values={},base){const props={},has=k=>Object.prototype.hasOwnProperty.call(values,k);
  if(has('deadline')&&schemaHasTaskField('最后期限'))props['最后期限']={date:values.deadline||null};
  if(has('estimate')&&schemaHasTaskField('预计时长'))props['预计时长']={number:values.estimate?Number(values.estimate):null};
  if(has('parallel')&&schemaHasTaskField('允许并行'))props['允许并行']={checkbox:!!values.parallel};
  if(!Object.keys(props).length)throw Error('WorkBuddy 任务表尚未增加 1.3 属性字段');
  return patch('tasks',tid,props,base);
 }
 async function addTagLink(tid,name){name=String(name||'').trim().slice(0,40);if(!name)return;if(!data.tags.some(t=>t['标签名称']===name))await addRaw('tags',{'标签名称':{text:name},'标签颜色':{select:'绿'},'创建时间':{date:new Date().toISOString()}});if(data.links.some(r=>r['任务ID']===tid&&r['标签名称']===name))return;await addRaw('links',{'关联标题':{text:name},'任务ID':{text:tid},'标签名称':{text:name},'创建时间':{date:new Date().toISOString()}});}
 async function transitionRaw(tid,next,at,expected,options={}){
  const t=await fresh('tasks',tid);if(t['回收站'])throw Error('任务已在回收站');
  if(options.guardFields)check(t,{},expected,'tasks',options.guardFields);
  const cur=t['任务状态']||C.STATUS[0];
  if(options.corrected&&(cur!=='进行中'||expected?.['任务状态']!=='进行中'||!C.same(t['状态开始时间'],expected['状态开始时间'])))throw Error('本次计时已被其他设备修改，未执行时间修正；请重新读取后核对');
  if(cur===next)return t;
  if(expected&&(cur!==(expected['任务状态']||C.STATUS[0])||!C.same(t['状态开始时间'],expected['状态开始时间'])))throw Error('其他设备已切换任务状态，请重新读取后操作');
  if(typeof db.transitionStatus==='function'){const result=await db.transitionStatus({recordId:tid,status:next,expectedVersion:t._version,...(options.corrected?{endedAt:at}:{})});if(!result?.task||!C.id(result.task))throw Error('状态保存未得到云端确认，请刷新核对');if(result.log)local('logs',result.log);return local('tasks',result.task);}
  const ts=new Date(at).toISOString(),end=Date.parse(ts),start=C.stamp(t['状态开始时间']);if(end>Date.now()+60000)throw Error('状态时间不能在未来');if(Number.isFinite(start)&&end<start)throw Error('状态切换不能早于本次开始时间');
  const logs=await all('logs');const props={'任务状态':{select:next},'状态开始时间':{date:ts},'状态结束时间':{date:C.terminal(next)?ts:null}};if(next==='完成')props['任务进度']={number:100};else if(C.terminal(cur))props['任务进度']={number:0};
  const updated=await updateRaw('tasks',tid,props,t);
  if(Number.isFinite(start)&&end>start&&!C.terminal(cur)){
   const open=logs.filter(l=>l['任务ID']===tid&&l['状态']===cur&&!l['结束时间']&&C.stamp(l['开始时间'])===start).sort((a,b)=>C.id(a).localeCompare(C.id(b)))[0];
   const lp={'结束时间':{date:ts},'持续时长':{number:Math.round((end-start)/3600000*10000)/10000}};
   try{if(open)await updateRaw('logs',C.id(open),lp,open);else await addRaw('logs',{...lp,'日志标题':{text:t['任务标题']+' · '+cur},'任务ID':{text:tid},'任务标题':{text:t['任务标题']},'任务类型':{select:t['任务类型']||'主任务'},'状态':{select:cur},'开始时间':{date:new Date(start).toISOString()}});}
   catch(e){throw partial('任务状态已保存，但时间日志未写入。请在时间明细中补记，勿再次切换来重试。',{taskId:tid,lostSegment:{status:cur,start:new Date(start).toISOString(),end:ts}});}
  }return updated;
 }
 function statusFields(tid,next,at){
  const fields={'任务状态':next,'状态开始时间':at,'状态结束时间':C.terminal(next)?at:null};
  if(next==='完成')fields['任务进度']=100;else if(C.terminal(get('tasks',tid)?.['任务状态']))fields['任务进度']=0;
  return fields;
 }
 function setStatus(tid,next,at=new Date().toISOString(),expected,options={}){
  if(!C.STATUS.includes(next))return Promise.reject(Error('未知任务状态'));
  const fields=statusFields(tid,next,at);
  const previous=statusFlights.get(tid),follows=previous&&(!expected||expected['任务状态']===previous.fields['任务状态']&&C.same(expected['状态开始时间'],previous.fields['状态开始时间']));
  const entry={fields,promise:optimisticWrite([{key:'tasks',id:tid,fields}],async()=>transitionRaw(tid,next,at,follows?await previous.promise:expected,options))};statusFlights.set(tid,entry);
  return entry.promise.finally(()=>{if(statusFlights.get(tid)===entry)statusFlights.delete(tid);});
 }
 function addWorklog(tid,body){return enqueue(async()=>{if(!String(body).trim())throw Error('先写一点执行记录');const t=await fresh('tasks',tid);if(t['回收站'])throw Error('任务已在回收站');const now=new Date().toISOString();return addRaw('notes',{'便签内容':{text:String(body).trim()},'便签分类':{select:'记录'},'关联任务ID':{text:tid},'关联任务标题':{text:t['任务标题']},'便签状态':{select:'已关联'},'置顶':{checkbox:false},'来源':{text:'OneDay.Lite/worklog'},'创建时间':{date:now},'更新时间':{date:now}});});}
 function createNote(body,category='灵感'){return enqueue(()=>{if(!String(body).trim())throw Error('先写下内容');const now=new Date().toISOString();return addRaw('notes',{'便签内容':{text:String(body).trim()},'便签分类':{select:category},'便签状态':{select:'未处理'},'置顶':{checkbox:false},'来源':{text:'OneDay.Lite/capture'},'创建时间':{date:now},'更新时间':{date:now}});});}
 function convertNote(nid){return enqueue(async()=>{const n=await fresh('notes',nid),linked=n['关联任务ID']||conversions[nid];if(linked){const existing=await fresh('tasks',linked);if(existing['回收站'])throw Error('原关联任务在回收站，请先恢复');if(!n['关联任务ID'])await updateRaw('notes',nid,{'关联任务ID':{text:linked},'关联任务标题':{text:existing['任务标题']},'便签状态':{select:'已关联'}},n);return existing;}
  const text=n['便签内容']||'';const t=await createRaw({title:C.plain(text.split('\n').find(s=>s.trim())||'新任务').slice(0,100),body:text});conversions[nid]=C.id(t);
  try{await updateRaw('notes',nid,{'关联任务ID':{text:C.id(t)},'关联任务标题':{text:t['任务标题']},'便签状态':{select:'已关联'},'更新时间':{date:new Date().toISOString()}},n);}catch(e){throw partial('任务已创建，原便签尚未关联。请刷新核对，不要重复转为任务。',{createdTask:C.id(t),noteId:nid});}return t;
 });}
 function trashTask(tid,restore=false,{pauseRunning=false}={}){
  const ids=[tid,...C.descendants(tid,data.tasks)],now=new Date().toISOString(),props=restore?{'回收站':{checkbox:false}}:{'回收站':{checkbox:true},'删除时间':{date:now}};
  return optimisticWrite(ids.map(id=>({key:'tasks',id,fields:values(props)})),async()=>{
   const rows=await all('tasks'),currentIds=[tid,...C.descendants(tid,rows)];if(!rows.some(r=>C.id(r)===tid))throw Error('任务不存在');
   const running=restore?[]:rows.filter(r=>currentIds.includes(C.id(r))&&r['任务状态']==='进行中'&&!r['回收站']);
   if(running.length&&!pauseRunning)throw Error('请先暂停正在执行的任务及子任务，再移入回收站');
   for(const row of running){const paused=await transitionRaw(C.id(row),'暂停',now,row);rows[rows.findIndex(r=>C.id(r)===C.id(row))]=paused;}
   let count=0;try{for(const id of currentIds){await updateRaw('tasks',id,props,rows.find(r=>C.id(r)===id));count++;}}catch(e){if(count)throw partial('已处理 '+count+' 项，其余未完成。请刷新回收站核对。');throw e;}
  });
 }
 function saveLog(tid,{id,status='进行中',start,end},base){return enqueue(async()=>{C.validateInterval(start,end);if(!C.STATUS.includes(status))throw Error('日志状态无效');const t=await fresh('tasks',tid);const props={'状态':{select:status},'开始时间':{date:new Date(start).toISOString()},'结束时间':{date:new Date(end).toISOString()},'持续时长':{number:Math.round((Date.parse(end)-Date.parse(start))/3600000*10000)/10000}};if(id)return patchRaw('logs',id,props,base);return addRaw('logs',{...props,'日志标题':{text:t['任务标题']+' · 补记'},'任务ID':{text:tid},'任务标题':{text:t['任务标题']},'任务类型':{select:t['任务类型']||'主任务'}});});}
 function backup(){return {app:'OneDay',edition:'Lite',version:'1.0.0',exportedAt:new Date().toISOString(),lastSuccessfulRead:state.lastRead?new Date(state.lastRead).toISOString():null,tableIds:{...IDS},tables:copy(data)};}
 return {get data(){return pendingEdits.length?Object.fromEntries(Object.entries(data).map(([key,rows])=>[key,rows.map(row=>visible(key,row))])):data;},state,capabilities,schemaHasTaskField,updateTaskAttributes,subscribe(f){listeners.push(f);return()=>listeners=listeners.filter(x=>x!==f);},read,get,patch,setStatus,createTask:(o,options)=>enqueue(()=>createRaw(o,options)),resumeTaskCreation,createNote,addWorklog,convertNote,trashTask,restoreTask:tid=>trashTask(tid,true),saveLog,backup,
  add:(key,props)=>enqueue(()=>addRaw(key,props)),addTag:(tid,name)=>enqueue(()=>addTagLink(tid,name)),
  removeLink:id=>enqueue(async()=>{const row=typeof db.getRecord==='function'?await fresh('links',id):get('links',id);await send('deleteRecord','links',{recordId:id,...(row?._version!==undefined?{expectedVersion:row._version}:{})});data.links=data.links.filter(r=>C.id(r)!==id);revision++;emit();}),
  connectUpdates(fn){if(db&&typeof db.onUpdated==='function')db.onUpdated(payload=>{if((payload&&payload.databaseIds||[]).some(id=>Object.values(IDS).includes(id)))fn();});},
  uploadImage:p=>{if(!db||typeof db.uploadImage!=='function')return Promise.reject(Error('当前宿主不支持图片上传'));return db.uploadImage(p);},
  canUploadFile:()=>!!(db&&typeof db.uploadFile==='function'),
  uploadFile:p=>{if(!db||typeof db.uploadFile!=='function')return Promise.reject(Error('当前 WorkBuddy 环境尚未开放文档附件上传'));return db.uploadFile(p);}
 };
}
return {createStore,IDS};
});
