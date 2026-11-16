/* Local-only SDK adapter. NEVER include this file in the WorkBuddy release. */
(function(){'use strict';window.__ONEDAY_LOCAL__=true;const KEY='oneday.lite.v1.local-data',ids={tasks:'oneday-tasks',logs:'oneday-logs',tags:'oneday-tags',links:'oneday-links',notes:'oneday-notes',sets:'oneday-sets',cal:'oneday-cal'},keys=Object.keys(ids),copy=o=>JSON.parse(JSON.stringify(o));let listeners=[];
const ago=m=>new Date(Date.now()-m*60000).toISOString(),date=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function seed(){const task=(i,title,status,days,clock,minutes,body,priority='中')=>{const t={_id:'lite-t'+i,'任务标题':title,'任务类型':'主任务','任务状态':status,'优先级':priority,'任务详情':body,'任务进度':status==='完成'?100:0,'创建时间':ago(5*1440+i*5),'状态开始时间':ago(minutes||60),'回收站':false};if(days!==null){t['计划开始时间']=date(days)+'T'+(clock||'00:00')+':00Z';t['计划截止时间']=date(days)+'T'+(clock?String(Number(clock.split(':')[0])+1).padStart(2,'0')+':'+clock.split(':')[1]:'23:59')+':00Z';}if(status==='完成')t['状态结束时间']=ago(minutes);return t;};const tasks=[
 task(1,'把产品方案打磨到可讨论的版本','进行中',0,'10:00',12,'先把问题讲清楚，再讨论解决办法。\n\n## 这一次，做到这些\n- [x] 梳理现有使用场景\n- [ ] 画出最重要的一条用户路径\n- [ ] 写下需要伙伴一起确认的三个问题\n\n> 不追求一次写完，只要比昨天更清楚一点。','高'),
 task(2,'读完收藏的那篇访谈','收集（未开始）',0,'15:00',240,'读完后，记下一句真正想留下的话。','低'),
 task(3,'整理这一周的零散记录','暂停',0,null,95,'把相关的便签连到对应任务。不重要的先归档，不着急删除。'),
 task(4,'确认下一次伙伴交流的议题','完成',0,'09:00',120,'已确认三项议题，邀请已发出。'),
 task(5,'给自己留半小时散步','收集（未开始）',1,'18:00',280,'不听播客，也不看消息。观察一段平常不会注意的路。','低'),
 task(6,'试试更轻的快速记录入口','收集（未开始）',null,null,280,'从手机打开，单手记下一句话。看看有哪里不顺手。'),
 task(7,'找一个让资料更好找的方法','收集（未开始）',null,null,1440,'先列出三个最近找不到的文件，不急着做完整体系。'),
 task(8,'给新项目列一份问题清单','收集（未开始）',2,'14:00',100,'谁在什么时刻，会为什么事情使用它？','高'),
 task(9,'把上周的方案发给伙伴','完成',-2,'14:00',2*1440,'已发送方案与待确认问题。')];
 const log=(id,tid,status,a,b)=>({_id:id,'日志标题':'示例 · '+status,'任务ID':'lite-t'+tid,'任务标题':tasks[tid-1]['任务标题'],'任务类型':'主任务','状态':status,'开始时间':ago(a),'结束时间':ago(b),'持续时长':(a-b)/60});const logs=[log('lite-l1',1,'进行中',190,145),log('lite-l2',1,'暂停',145,12),log('lite-l3',3,'进行中',120,95),log('lite-l4',4,'进行中',160,120),log('lite-l5',9,'进行中',2*1440+35,2*1440)];
 const note=(id,body,cat,mins,pin=false,tid='')=>({_id:'lite-n'+id,'便签内容':body,'便签分类':cat,'便签状态':tid?'已关联':'未处理','置顶':pin,'关联任务ID':tid?'lite-t'+tid:'','关联任务标题':tid?tasks[tid-1]['任务标题']:'','创建时间':ago(mins),'更新时间':ago(mins),'来源':'OneDay.Lite/demo'});
 const notes=[note(1,'好的工具，应该让人少想一步。\n\n不是把所有功能摆出来，而是在需要的时候，刚好找得到。','灵感',300,true),note(2,'也许可以给每次会议留一张“下一步”小纸条。\n只写决定了什么、谁来做、什么时候再看。','灵感',600),note(3,'今天先厘清了核心使用场景。接下来重点确认输入是否足够轻。','记录',145,false,1),note(4,'参考资料已经整理好，先暂停，等伙伴给出反馈。','记录',95,false,3),note(5,'下次做用户交流时，先问最近一次真实经历，而不是问“你会不会用”。','记录',900),note(6,'把桌面上那一摞纸整理一下。','待办',1200)];
 return {tasks,logs,notes,tags:[{_id:'lite-tag1','标签名称':'工作','标签颜色':'绿'},{_id:'lite-tag2','标签名称':'生活','标签颜色':'蓝'}],links:[{_id:'lite-link1','任务ID':'lite-t1','标签名称':'工作'},{_id:'lite-link2','任务ID':'lite-t5','标签名称':'生活'}],sets:[],cal:[]};}
function valid(data){if(!data||!keys.every(k=>Array.isArray(data[k])))throw Error('本机数据格式不完整。请导出或恢复备份，未覆盖现有存储。');for(const k of keys){const seen=new Set();for(const r of data[k]){const id=r._id||r.record_id||r.id;if(!id||seen.has(id))throw Error('本机记录 ID 缺失或重复，已停止写入。');seen.add(id);}}return data;}
let data;try{const raw=localStorage.getItem(KEY);data=raw?valid(JSON.parse(raw)):seed();if(!raw)localStorage.setItem(KEY,JSON.stringify(data));}catch(e){window.__ONEDAY_LOCAL_ERROR__='本机存储无法读取或写入：'+e.message;data=Object.fromEntries(keys.map(k=>[k,[]]));}
function reload(){if(window.__ONEDAY_LOCAL_ERROR__)throw Error(window.__ONEDAY_LOCAL_ERROR__);const raw=localStorage.getItem(KEY);if(raw)data=valid(JSON.parse(raw));}
function commit(next,id){try{localStorage.setItem(KEY,JSON.stringify(next));}catch(e){throw Error('本机存储保存失败：'+e.message+'；请保留草稿并导出。');}data=next;queueMicrotask(()=>listeners.forEach(fn=>fn({databaseIds:[id]})));}
const key=id=>{const k=keys.find(k=>ids[k]===id);if(!k)throw Error('未知的示例数据表');return k;},values=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v==null?v:Object.values(v)[0]]));
window.__SMART_PAGE__={database:{
 taskFields:['最后期限','预计时长','允许并行'],
 async query({databaseId,pageSize=200,startCursor}){reload();const k=key(databaseId),start=Number(startCursor||0),rows=data[k].slice(start,start+pageSize);return {results:copy(rows),hasMore:start+pageSize<data[k].length,nextCursor:start+pageSize<data[k].length?String(start+pageSize):undefined};},
 async addRecord({databaseId,properties}){reload();const k=key(databaseId),id='lite-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),next=copy(data);next[k].push({_id:id,...values(properties)});commit(next,databaseId);return {id};},
 async updateRecord({databaseId,recordId,properties}){reload();const k=key(databaseId),next=copy(data),i=next[k].findIndex(r=>(r._id||r.record_id||r.id)===recordId);if(i<0)throw Error('记录不存在');next[k][i]={...next[k][i],...values(properties)};commit(next,databaseId);return {};},
 async deleteRecord({databaseId,recordId}){reload();const k=key(databaseId),next=copy(data);next[k]=next[k].filter(r=>(r._id||r.record_id||r.id)!==recordId);commit(next,databaseId);return {};},
 onUpdated(fn){listeners.push(fn);},
 async uploadImage({file}){return {url:'https://preview.invalid/oneday/image/'+encodeURIComponent(file?.name||'image'),name:file?.name||'image',previewOnly:true};},
 async uploadFile({file}){return {url:'https://preview.invalid/oneday/file/'+encodeURIComponent(file?.name||'file'),name:file?.name||'file',previewOnly:true};}
}};
window.__onedayRestore=function(backup){const next=valid(copy(backup.tables));localStorage.setItem(KEY,JSON.stringify(next));data=next;window.__ONEDAY_LOCAL_ERROR__='';listeners.forEach(fn=>fn({databaseIds:Object.values(ids)}));};
window.addEventListener('storage',e=>{if(e.key===KEY){try{reload();listeners.forEach(fn=>fn({databaseIds:Object.values(ids)}));}catch(err){window.__ONEDAY_LOCAL_ERROR__=err.message;}}});
})();
