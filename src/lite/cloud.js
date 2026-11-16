/* OneDay Sites SDK bridge. All confirmed records and attachments come from the server. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.OneDayCloud=api;root.__ONEDAY_SITES__=true;root.__SMART_PAGE__={database:api.createDatabase({fetch:root.fetch.bind(root),origin:root.location.origin})};}})(typeof window!=='undefined'?window:this,function(){
'use strict';
const IDS={tasks:'oneday-tasks',logs:'oneday-logs',tags:'oneday-tags',links:'oneday-links',notes:'oneday-notes',sets:'oneday-sets',cal:'oneday-cal'};
const KEYS=Object.keys(IDS),ALIASES=new Set(['_id','id','record_id','_version']);
const idOf=r=>String(r?._id||r?.record_id||r?.id||'');
function canonical(row){const obj={};for(const k of Object.keys(row).filter(k=>!ALIASES.has(k)).sort())obj[k]=stable(row[k]);return JSON.stringify(obj);}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort()){if(['__proto__','constructor','prototype'].includes(k))throw Error('备份包含不安全字段');o[k]=stable(v[k]);}return o;}return v;}
function validateBackup(backup){
 if(!backup||backup.app&&backup.app!=='OneDay')throw Error('请选择 OneDay 的完整 JSON 备份');
 const tables={};let total=0;
 for(const key of KEYS){const rows=backup.tables?.[key];if(!Array.isArray(rows))throw Error('备份缺少 '+key+' 表');const seen=new Set();tables[key]=rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error(key+' 表存在无效记录');
  const id=row._id??row.id??row.record_id;
  if(typeof id!=='string'||!id.trim()||id.length>256||/[\x00-\x1f\x7f]/.test(id))throw Error(key+' 表存在无效 ID 的记录');
  for(const alias of ['_id','id','record_id'])if(row[alias]!==undefined&&(typeof row[alias]!=='string'||row[alias]!==id))throw Error(key+' 表的记录 ID 别名不一致，请先核对备份');
  if(seen.has(id))throw Error(key+' 表存在重复 ID');seen.add(id);canonical(row);const out={_id:id};for(const k of Object.keys(row))if(!ALIASES.has(k))out[k]=row[k];return out;
 });total+=rows.length;}
 if(total>100000)throw Error('单次导入最多 10 万条记录，请分批整理备份');return{tables,total};
}
function createDatabase({fetch:fetcher=globalThis.fetch,origin='',uuid=()=>globalThis.crypto.randomUUID()}={}){
 let acknowledgedRevision=null,pendingRevision=null,invalidated=true;
 const pendingCreates=new Map();let pendingStorage=null,pendingStorageKey='';
 try{if(typeof window!=='undefined'){pendingStorage=window.localStorage;pendingStorageKey='oneday.lite.v1.'+(window.__ONEDAY_SCOPE__||'sites.guest')+'.pendingCreates';const saved=JSON.parse(pendingStorage.getItem(pendingStorageKey)||'[]');for(const [key,value]of saved)if(typeof key==='string'&&value?.requestId&&value?.recordId)pendingCreates.set(key,value);}}catch(_){}
 const persistPending=()=>{try{pendingStorage?.setItem(pendingStorageKey,JSON.stringify([...pendingCreates]));}catch(_){}};
 async function creationKey(key,properties){const fields={...properties};if(['tasks','notes','tags','links'].includes(key))delete fields['创建时间'];if(key==='tasks')delete fields['状态开始时间'];if(key==='notes')delete fields['更新时间'];const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(key+JSON.stringify(stable(fields))));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
 const listeners=[];
 const table=id=>{const key=KEYS.find(k=>IDS[k]===id)|| (KEYS.includes(id)?id:null);if(!key)throw Error('未知数据表');return key;};
 async function request(path,{method='GET',body,raw=false,retry=true}={}){
  const headers={Accept:'application/json'};if(body!==undefined&&!raw)headers['Content-Type']='application/json';
  const options={method,headers,credentials:'same-origin',cache:'no-store',redirect:'error'};if(body!==undefined)options.body=raw?body:JSON.stringify(body);
  let response;
  for(let attempt=0;attempt<(retry?2:1);attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),raw?120000:30000);
   try{response=await fetcher(origin+'/api/oneday'+path,{...options,signal:controller.signal});if(response.status>=500&&attempt===0&&retry){await response.body?.cancel();continue;}break;}
   catch(e){if(attempt+1>=(retry?2:1)){const error=Error(e.name==='AbortError'?'网络请求超时，请保留草稿后重试':'暂时无法连接云端，内容草稿仍保留在此设备');error.network=true;throw error;}}
   finally{clearTimeout(timer);}
  }
  let data;try{data=await response.json();}catch(_){const e=Error('云端返回异常，请刷新或重新登录');e.status=response.status;throw e;}
  if(typeof window!=='undefined')window.__ONEDAY_AUTH_REQUIRED__=response.status===401;
  if(!response.ok){const error=Error(typeof data.error==='string'?data.error:data.message||'云端操作失败');error.status=response.status;error.code=data.code;error.details=data;throw error;}
  return data;
 }
 const changed=()=>{invalidated=true;listeners.forEach(fn=>fn({databaseIds:Object.values(IDS)}));};
 async function mutate(path,body,method='POST'){const result=await request(path,{method,body:{...body,requestId:body.requestId||uuid()}});changed();return result;}
 async function readPages(path){const rows=[],seen=new Set();let cursor;for(let page=0;page<100000;page++){const params=new URLSearchParams({limit:'200'});if(cursor)params.set('cursor',cursor);const result=await request(path+'?'+params);if(!Array.isArray(result.results))throw Error('备份分页返回异常，未生成不完整文件');rows.push(...result.results);if(rows.length>100000)throw Error('记录超过当前完整备份的 10 万条安全上限，未生成不完整文件');if(!result.hasMore)return rows;if(!result.nextCursor||seen.has(result.nextCursor)||!result.results.length)throw Error('备份分页游标异常，未生成不完整文件');cursor=result.nextCursor;seen.add(cursor);}throw Error('备份分页超过安全上限，未生成不完整文件');}
 async function exportBackup(){try{return await request('/backup');}catch(error){if(error.status!==413)throw error;}
  for(let attempt=0;attempt<3;attempt++){const revision=String((await request('/revision')).revision),pages=await Promise.all([...KEYS.map(key=>readPages('/records/'+key)),readPages('/files')]);if(revision!==String((await request('/revision')).revision))continue;const tables=Object.fromEntries(KEYS.map((key,i)=>[key,pages[i]]));if(KEYS.reduce((n,key)=>n+tables[key].length,0)>100000)throw Error('记录超过当前完整备份的 10 万条安全上限，未生成不完整文件');return{app:'OneDay',edition:'Sites',version:'1.9.0',exportedAt:new Date().toISOString(),revision,tables,attachments:pages[KEYS.length],attachmentBytesIncluded:false,attachmentNotice:'此 JSON 包含附件清单与受保护地址；附件原始字节需另行下载保存。'};}throw Error('备份期间记录持续变化，请等其他设备保存完成后重试；未生成不完整文件');
 }
 const db={
  kind:'sites',taskFields:['最后期限','预计时长','允许并行'],capabilities:{taskFields:['最后期限','预计时长','允许并行'],atomicVersion:true,cloud:true},
  session:()=>request('/session'),
  async query({databaseId,pageSize=200,startCursor}={}){const params=new URLSearchParams({limit:String(Math.max(1,Math.min(200,pageSize)))});if(startCursor)params.set('cursor',startCursor);return request('/records/'+table(databaseId)+'?'+params);},
  async getRecord({databaseId,recordId}){return (await request('/records/'+table(databaseId)+'/'+encodeURIComponent(recordId))).record;},
  async getPendingCreate({databaseId,properties}){const key=await creationKey(table(databaseId),properties),identity=pendingCreates.get(key)||[...pendingCreates.values()].find(value=>value.intentKey===key);return identity?.properties?JSON.parse(JSON.stringify({requestId:identity.requestId,recordId:identity.recordId,properties:identity.properties})):null;},
  async addRecord({databaseId,properties,intentProperties}){
   const key=await creationKey(table(databaseId),properties);let identity=pendingCreates.get(key);
   if(!identity){identity={requestId:uuid(),recordId:uuid(),properties:JSON.parse(JSON.stringify(properties))};if(intentProperties)identity.intentKey=await creationKey(table(databaseId),intentProperties);pendingCreates.set(key,identity);persistPending();}
   // The original draft is only a local lookup alias. Replays send the exact
   // acknowledged-operation shape, without introducing a server schema field.
   try{const result=await mutate('/records/'+table(databaseId),{requestId:identity.requestId,recordId:identity.recordId,properties:identity.properties||properties});pendingCreates.delete(key);persistPending();return result.record;}
   catch(e){if(e.network||e.status>=500)e.message+='。新增结果尚未确认，刷新核对后可再次提交同一内容，系统会使用同一请求避免重复创建';else if(e.status===400){pendingCreates.delete(key);persistPending();}throw e;}
  },
  async updateRecord({databaseId,recordId,properties,expectedVersion}){if(!Number.isInteger(expectedVersion))throw Error('缺少记录版本，请刷新后再保存；草稿已保留');return (await mutate('/records/'+table(databaseId)+'/'+encodeURIComponent(recordId),{properties,expectedVersion},'PATCH')).record;},
  async deleteRecord({databaseId,recordId,expectedVersion}){if(!Number.isInteger(expectedVersion))throw Error('缺少记录版本，请刷新后再操作');return mutate('/records/'+table(databaseId)+'/'+encodeURIComponent(recordId),{expectedVersion},'DELETE');},
  async transitionStatus({recordId,status,expectedVersion,endedAt}){return mutate('/tasks/'+encodeURIComponent(recordId)+'/status',{status,expectedVersion,...(endedAt!==undefined?{endedAt}:{})});},
  async uploadImage(args){return db.uploadFile(args);},
  async uploadFile({file,owner}){if(!file)throw Error('请选择附件');if(file.size>20*1024*1024)throw Error('单个附件请不超过 20 MB');const form=new FormData();form.append('file',file,file.name||'附件');if(owner)form.append('owner',JSON.stringify(owner));const result=await request('/files',{method:'POST',body:form,raw:true,retry:false});changed();return result;},
  exportBackup,
  async checkRevision(){const {revision}=await request('/revision');pendingRevision=String(revision);return invalidated||acknowledgedRevision!==pendingRevision;},
  didRead(revision=pendingRevision){acknowledgedRevision=revision;invalidated=false;},
  snapshotVersion:async()=>String((await request('/revision')).revision),
  onUpdated(fn){listeners.push(fn);return()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};},
  async previewImport(backup){const incoming=validateBackup(backup),current=await db.exportBackup();let added=0,skipped=0;const conflicts=[];const counts={};for(const key of KEYS){const existing=new Map((current.tables?.[key]||[]).map(r=>[idOf(r),r]));counts[key]=incoming.tables[key].length;for(const row of incoming.tables[key]){const old=existing.get(idOf(row));if(!old)added++;else if(canonical(old)===canonical(row))skipped++;else conflicts.push({table:key,id:idOf(row),title:row['任务标题']||row['便签内容']?.slice(0,50)||idOf(row)});}}return {...incoming,added,skipped,conflicts,counts,attachmentCount:Array.isArray(backup.attachments)?backup.attachments.length:0};},
  async importBackup(backup,onProgress=()=>{}){const prepared=await db.previewImport(backup);if(prepared.conflicts.length)throw Error('发现 '+prepared.conflicts.length+' 条同 ID 不同内容的记录，已停止导入，云端原记录未覆盖');const rows=[];for(const key of KEYS)for(const row of prepared.tables[key])rows.push({key,row});let imported=0,skipped=0;const encoder=new TextEncoder();for(let i=0;i<rows.length;){const tables={};let end=i,bytes=1024;while(end<rows.length&&end-i<100){const {key,row}=rows[end],size=encoder.encode(JSON.stringify(row)).length+32;if(end>i&&bytes+size>6*1024*1024)break;if(size>6*1024*1024)throw Error('记录 '+idOf(row)+' 过大，已停止导入；此前确认导入的记录仍保留');bytes+=size;(tables[key]||=[]).push(row);end++;}try{const r=await mutate('/import',{tables});imported+=r.imported||0;skipped+=r.skipped||0;onProgress({done:end,total:rows.length,imported,skipped});}catch(e){e.message='导入停在 '+i+'/'+rows.length+' 条：'+e.message+'。已导入内容保留，可重新选择同一备份继续。';throw e;}i=end;}return {imported,skipped,total:rows.length};}
 };
 return db;
}
return{createDatabase,IDS,validateBackup,canonical};
});
