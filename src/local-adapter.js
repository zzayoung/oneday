/* Local-only adapter. This file is never included in WorkBuddy production HTML. */
(function(){
  'use strict';
  var STORAGE='oneday.v10.local-demo.data',SEED=/*__DEMO_DATA__*/;
  var IDS=/*__TABLE_IDS__*/,DATA=JSON.parse(JSON.stringify(SEED)),handler=null;
  window.__ONEDAY_LOCAL__=true;
  try{var stored=localStorage.getItem(STORAGE);if(stored){var parsed=JSON.parse(stored);if(!parsed||!parsed.tables)throw new Error('备份结构异常');Object.keys(IDS).forEach(function(k){if(!Array.isArray(parsed.tables[IDS[k]]))throw new Error('缺少表 '+k);});DATA=parsed.tables;}}catch(e){window.__ONEDAY_LOCAL_ERROR__='本机数据未能载入：'+e.message;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function latest(){
    var raw=localStorage.getItem(STORAGE);if(raw){var parsed=JSON.parse(raw);if(!parsed.tables)throw new Error('本机存储已损坏，请先导出当前快照并检查');return clone(parsed.tables);}return clone(DATA);
  }
  function commit(next,id){
    // Persist first. A storage denial/quota failure rejects the write instead of claiming success.
    localStorage.setItem(STORAGE,JSON.stringify({version:10,updated:Date.now(),tables:next}));DATA=next;
    if(handler)setTimeout(function(){handler({databaseIds:[id]});},0);
  }
  function rowFrom(props){var row={};Object.keys(props).forEach(function(k){var p=props[k];if(!p||typeof p!=='object')throw new Error('无效字段 '+k);row[k]=p[Object.keys(p)[0]];});return row;}
  var database={
    query:function(p){var rows=DATA[p.databaseId];if(!rows)return Promise.reject(new Error('体验版未配置此表'));
      var pos=Number(p.startCursor||0),size=Math.min(200,Number(p.pageSize)||200);return Promise.resolve({results:clone(rows.slice(pos,pos+size)),hasMore:pos+size<rows.length,nextCursor:pos+size<rows.length?String(pos+size):null});},
    addRecord:function(p){return Promise.resolve().then(function(){var next=latest();if(!next[p.databaseId])throw new Error('表不存在');var id='local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),r=rowFrom(p.properties);r._id=id;next[p.databaseId].push(r);commit(next,p.databaseId);return {id:id};});},
    updateRecord:function(p){return Promise.resolve().then(function(){var next=latest(),list=next[p.databaseId]||[],row=list.filter(function(r){return(r._id||r.record_id)===p.recordId;})[0];if(!row)throw new Error('记录不存在');var patch=rowFrom(p.properties);Object.keys(patch).forEach(function(k){row[k]=patch[k];});commit(next,p.databaseId);return {id:p.recordId};});},
    deleteRecord:function(p){return Promise.resolve().then(function(){var next=latest(),list=next[p.databaseId]||[],i=list.findIndex(function(r){return(r._id||r.record_id)===p.recordId;});if(i<0)throw new Error('记录不存在');list.splice(i,1);commit(next,p.databaseId);return {};});},
    onUpdated:function(fn){handler=fn;},
    uploadImage:function(p){return Promise.reject(new Error('本机体验版不提供云图片上传；请在 WorkBuddy 正式页面使用原有图片功能。'));}
  };
  window.__SMART_PAGE__={database:database};
  window.__onedayRestore=function(backup){var next={};Object.keys(IDS).forEach(function(k){next[IDS[k]]=clone(backup.tables[k]);});commit(next,IDS.tasks);window.__ONEDAY_LOCAL_ERROR__='';};
  window.addEventListener('storage',function(e){if(e.key!==STORAGE||!e.newValue)return;try{var next=JSON.parse(e.newValue);if(next.tables){DATA=next.tables;if(handler)handler({databaseIds:Object.keys(IDS).map(function(k){return IDS[k];})});}}catch(e){}});
})();
