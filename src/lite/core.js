/* OneDay Lite: pure data/calendar/time/Markdown helpers. Shared V10 contracts, no network. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../core.js'));else root.OneDayLiteCore=factory(root.OneDayCore);})(typeof window!=='undefined'?window:this,function(B){
'use strict';
const STATUS=['收集（未开始）','进行中','暂停','完成','结束（未完成）'];
const LABEL=['待开始','进行中','已暂停','已完成','已结束'];
const id=r=>r&&(r._id||r.record_id||r.id)||'';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=v=>v?Date.parse(v):NaN;
const terminal=s=>s===STATUS[3]||s===STATUS[4];
const day=v=>String(v||'').slice(0,10);
const localDay=(d=new Date())=>B.dateString(d);
const pad=v=>String(v).padStart(2,'0');
function merge(intervals){const a=intervals.filter(v=>Number.isFinite(v[0])&&Number.isFinite(v[1])&&v[1]>v[0]).sort((a,b)=>a[0]-b[0]);let out=[];for(const v of a){const p=out[out.length-1];if(p&&v[0]<=p[1])p[1]=Math.max(p[1],v[1]);else out.push(v.slice());}return out;}
const length=a=>a.reduce((s,v)=>s+v[1]-v[0],0);
function taskTime(t,logs,now=Date.now(),range){
 const tid=id(t),state=t['任务状态']||STATUS[0],start=stamp(t['状态开始时间']);let segments=[],issues=[];
 const low=range?range[0]:-Infinity,high=Math.min(now,range?range[1]:now);
 for(const r of logs.filter(r=>r['任务ID']===tid)){
  const a=stamp(r['开始时间']),b=stamp(r['结束时间']);
  if(!r['结束时间']){if(!(r['状态']===state&&a===start&&!terminal(state)))issues.push('存在未闭合的历史日志，未计入用时');continue;}
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a){issues.push('存在时间无效的日志，未计入用时');continue;}
  if(b>now+60000)issues.push('存在结束时间在未来的日志，暂截到当前时刻');
  const end=Math.min(b,now);if(end>a)segments.push({id:id(r),status:r['状态'],start:a,end: end,live:false});
 }
 if(!terminal(state)){
  if(Number.isFinite(start)&&start<=now)segments.push({id:'current',status:state,start,end:now,live:true});
  else if(state==='进行中')issues.push('进行中的开始时间缺失或在未来，未推算用时');
 }
 const select=s=>segments.filter(v=>v.status===s).map(v=>[Math.max(v.start,low),Math.min(v.end,high)]).filter(v=>v[1]>v[0]);
 const raw=select('进行中'),intervals=merge(raw);const doing=length(intervals),overlap=length(raw)-doing;
 if(overlap>0)issues.push('同一任务的重叠执行时段已去重');
 const created=stamp(t['创建时间']);const finish=terminal(state)&&Number.isFinite(start)?Math.min(start,now):now;
 return {doing,paused:length(merge(select('暂停'))),waiting:length(merge(select(STATUS[0]))),elapsed:Number.isFinite(created)?Math.max(0,finish-created):0,
  intervals,overlap,segments:segments.sort((a,b)=>b.start-a.start),issues:[...new Set(issues)],running:state==='进行中'&&Number.isFinite(start)&&start<=now,runningSince:start};
}
function summary(tasks,logs,now=Date.now(),range){let rows=[],all=[];for(const t of tasks){if(t['回收站'])continue;let time=taskTime(t,logs,now,range);if(time.doing>0){rows.push({task:t,...time});all.push(...time.intervals);}}rows.sort((a,b)=>b.doing-a.doing);const total=rows.reduce((a,b)=>a+b.doing,0),unique=length(merge(all));return {rows,total,unique,overlap:total-unique};}
function weekDays(ds){let d=new Date(ds+'T12:00:00'),offset=(d.getDay()+6)%7;return Array.from({length:7},(_,i)=>B.plusDays(ds,i-offset));}
function monthDays(ds){const first=ds.slice(0,7)+'-01',d=new Date(first+'T12:00:00'),start=weekDays(first)[0];const last=new Date(d.getFullYear(),d.getMonth()+1,0);const days=(last-new Date(start+'T12:00:00'))/86400000+1;return Array.from({length:Math.ceil(days/7)*7},(_,i)=>B.plusDays(start,i));}
function shiftMonth(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+n);return localDay(d);}
function onDay(t,ds){const a=day(t['计划开始时间']),b=day(t['计划截止时间']);return a&&b?a<=ds&&b>=ds:(a||b)===ds;}
function movePlan(t,ds){if(!B.validDate(ds))throw Error('日期无效');const a=t['计划开始时间'],b=t['计划截止时间'];if(!a&&!b)return {'计划开始时间':{date:ds+'T00:00:00Z'},'计划截止时间':{date:ds+'T23:59:00Z'}};const ref=day(a||b),delta=Math.round((Date.parse(ds+'T00:00:00Z')-Date.parse(ref+'T00:00:00Z'))/86400000),out={};for(const k of ['计划开始时间','计划截止时间'])if(t[k])out[k]={date:B.plusDays(day(t[k]),delta)+t[k].slice(10)};return out;}
const TL_SNAP=10,TL_DAY=1440;
function planMinute(v){const m=String(v||'').match(/T(\d{2}):(\d{2})/);if(!m)return null;const h=Number(m[1]),n=Number(m[2]);return h>=0&&h<24&&n>=0&&n<60?h*60+n:null;}
const snapMinute=v=>Math.max(0,Math.min(TL_DAY,Math.round(Number(v||0)/TL_SNAP)*TL_SNAP));
function timelineRange(t,ds){const a=t['计划开始时间'],b=t['计划截止时间'],ad=day(a),bd=day(b);if(!a&&!b)return null;if(!onDay(t,ds))return null;
 const am=planMinute(a),bm=planMinute(b),spans=!!(ad&&bd&&ad!==bd);
 if(spans)return {kind:'span',start:ad===ds?(am??0):0,end:bd===ds?(bm??TL_DAY):TL_DAY,spans:true};
 if(ad===ds&&bd===ds&&am===0&&bm!=null&&bm>=1439)return {kind:'all-day',start:0,end:TL_DAY,spans:false};
 if(ad===ds&&am!=null){let end=bm;if(end==null||end<=am)end=Math.min(TL_DAY,am+60);return {kind:'timed',start:am,end,spans:false};}
 if(bd===ds&&bm!=null){const start=Math.max(0,bm-60);return {kind:'timed',start,end:bm,spans:false};}
 return {kind:'all-day',start:0,end:TL_DAY,spans:false};
}
function taskEstimateMinutes(t){const n=Number(t&&t['预计时长']);return Number.isFinite(n)&&n>0?Math.min(480,Math.max(TL_SNAP,Math.round(n/TL_SNAP)*TL_SNAP)):60;}
function isParallel(t){return !!(t&&t['允许并行']);}
function timelineLayout(rows,ds,opts={}){const role=opts.role||'combined',parentId=opts.parentId||'';let bars=[];
 for(const t of rows||[]){const isSub=!!(t['任务类型']==='子任务'||t['父任务ID']);if(role==='main'&&isSub)continue;if(role==='sub'&&t['父任务ID']!==parentId)continue;const r=timelineRange(t,ds);if(!r||r.kind!=='timed')continue;bars.push({id:id(t),task:t,start:r.start,end:r.end,isSub,track:'main',lane:0,laneCount:1});}
 bars.sort((a,b)=>a.start-b.start||a.end-b.end||String(a.id).localeCompare(String(b.id)));
 const overlaps=(a,b)=>Math.max(a.start,b.start)<Math.min(a.end,b.end);
 for(const b of bars){if(isParallel(b.task)&&bars.some(x=>x!==b&&overlaps(b,x)))b.track='parallel';}
 const parallel=bars.filter(b=>b.track==='parallel');let cluster=[],clusterEnd=-1;
 const finish=()=>{if(!cluster.length)return;const laneEnds=[];for(const b of cluster){let lane=laneEnds.findIndex(v=>v<=b.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=b.end;b.lane=lane;}const n=Math.max(1,laneEnds.length);cluster.forEach(b=>b.laneCount=n);cluster=[];clusterEnd=-1;};
 for(const b of parallel){if(cluster.length&&b.start>=clusterEnd)finish();cluster.push(b);clusterEnd=Math.max(clusterEnd,b.end);}finish();return bars;
}
function scheduleScope(task){return task?.['父任务ID']||task?.['任务类型']==='子任务'?{role:'sub',parentId:task['父任务ID']||''}:{role:'main',parentId:''};}
// Planned dates are wall-clock values, including legacy strings ending in Z.
// Parse the written components; never shift a plan through the device timezone.
function planClock(value,end=false){
 if(!value)return null;const m=String(value).match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
 if(!m||!B.validDate(m[1])||(m[2]!==undefined&&(Number(m[2])>23||Number(m[3])>59||Number(m[4]||0)>59)))throw Error('请输入有效的计划日期和时间');
 const h=m[2]===undefined?(end?23:0):Number(m[2]),n=m[3]===undefined?(end?59:0):Number(m[3]),s=Number(m[4]||0),ms=Number((m[5]||'').padEnd(3,'0'));
 return {date:m[1],minute:m[2]===undefined?null:h*60+n+s/60+ms/60000,wall:Date.parse(m[1]+'T'+pad(h)+':'+pad(n)+':'+pad(s)+'.'+String(ms).padStart(3,'0')+'Z')};
}
function timelineConflicts(rows,ds,taskId,start,end,options={}){
 const candidate=options.candidate||(rows||[]).find(task=>id(task)===taskId),scope=options.scope||scheduleScope(candidate);
 return timelineLayout((rows||[]).filter(task=>!task['回收站']),ds,scope).map(bar=>{
  // Keep second-level legacy precision when inspecting existing occupied time.
  try{const a=planClock(bar.task['计划开始时间']),b=planClock(bar.task['计划截止时间'],true);return {...bar,start:a?.date===ds&&a.minute!==null?a.minute:bar.start,end:b?.date===ds&&b.minute!==null&&b.minute>bar.start?b.minute:bar.end};}catch(_){return bar;}
 }).filter(bar=>bar.id!==taskId&&!isParallel(bar.task)&&Math.max(start,bar.start)<Math.min(end,bar.end));
}
function timelinePlan(rows,ds,taskId,start,end,options={}){
 start=Number(start);end=Number(end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>TL_DAY||end<=start)throw Error('结束时间必须晚于开始时间，并位于当天');
 const dur=end-start,dayEnd=options.dayEnd??TL_DAY,conflicts=timelineConflicts(rows,ds,taskId,start,end,options);if(!conflicts.length)return {conflicts,next:{start,end}};
 const free=s=>s>=0&&s+dur<=dayEnd&&!timelineConflicts(rows,ds,taskId,s,s+dur,options).length;
 // Only proposed available slots snap; an explicitly typed range stays exact.
 for(let s=Math.floor(start/TL_SNAP)*TL_SNAP+TL_SNAP;s+dur<=dayEnd;s+=TL_SNAP)if(free(s))return {conflicts,next:{start:s,end:s+dur}};
 for(let s=Math.ceil(start/TL_SNAP)*TL_SNAP-TL_SNAP;s>=0;s-=TL_SNAP)if(free(s))return {conflicts,next:{start:s,end:s+dur}};
 return {conflicts,next:null};
}
function scheduleISO(ds,minute){
 const total=Math.round(minute*60000),h=Math.floor(total/3600000),m=Math.floor(total%3600000/60000),s=Math.floor(total%60000/1000),ms=total%1000;
 return ds+'T'+pad(h)+':'+pad(m)+':'+pad(s)+(ms?'.'+String(ms).padStart(3,'0'):'')+'Z';
}
function schedulePlan(rows,candidate){
 const a=planClock(candidate['计划开始时间']),b=planClock(candidate['计划截止时间'],true);if(a&&b&&b.wall<=a.wall)throw Error('计划结束时间必须晚于开始时间');
 const date=a?.date||b?.date||'',scope=scheduleScope(candidate),range=date?timelineRange(candidate,date):null;
 const plan={candidate,date,scope,kind:range?.kind||'unscheduled',start:range?.start??null,end:range?.end??null,conflicts:[],next:null};
 if(!range||range.kind!=='timed')return plan;
 if(a?.minute!==null&&a?.date===date)plan.start=a.minute;if(b?.minute!==null&&b?.date===date)plan.end=b.minute;
 if(isParallel(candidate))return plan;
 const result=timelinePlan(rows,date,id(candidate),plan.start,plan.end,{candidate,dayEnd:1439});plan.conflicts=result.conflicts;
 if(result.conflicts.length&&result.next){const nextProps={'计划开始时间':{date:scheduleISO(date,result.next.start)},'计划截止时间':{date:scheduleISO(date,result.next.end)}};plan.next={date,start:result.next.start,end:result.next.end,props:nextProps};}
 return plan;
}
function reorder(source,id,target,index){const src=Array.from(source||[]).filter(x=>x!==id),dst=Array.from(target||[]).filter(x=>x!==id);let at=Number(index);if(!Number.isFinite(at))at=dst.length;at=Math.max(0,Math.min(dst.length,Math.trunc(at)));dst.splice(at,0,id);return {source:src,target:dst};}
function calendarLabel(ds,markers){const list=(markers||[]).filter(m=>day(m['标记日期'])===ds),order=[['请假','leave'],['法定节假日','holiday'],['调休上班','workday'],['自定义','custom']];for(const [type,kind] of order){const m=list.find(x=>x['标记类型']===type);if(m)return {kind,text:String(m['标记标题']||type)};}const d=new Date(ds+'T12:00:00');return d.getDay()===0||d.getDay()===6?{kind:'weekend',text:'周末'}:{kind:'none',text:''};}
function timelineMove(start,end,delta){start=Number(start);end=Number(end);let dur=Math.max(TL_SNAP,end-start),next=snapMinute(start+Number(delta||0));next=Math.min(next,TL_DAY-dur);next=Math.max(0,next);return {start:next,end:next+dur};}
function timelineResize(start,end,edge,target){start=Number(start);end=Number(end);target=snapMinute(target);if(edge==='start')start=Math.min(Math.max(0,target),end-TL_SNAP);else end=Math.max(Math.min(TL_DAY,target),start+TL_SNAP);return {start,end};}
function timelineISO(ds,min,end=false){min=Math.max(0,Math.min(TL_DAY,Math.round(min)));if(min>=TL_DAY)return ds+'T23:59:00Z';const h=Math.floor(min/60),m=min%60;return ds+'T'+pad(h)+':'+pad(m)+':00Z';}
function timelinePatch(ds,start,end){if(!B.validDate(ds))throw Error('日期无效');if(end<=start)throw Error('结束时间必须晚于开始时间');return {'计划开始时间':{date:timelineISO(ds,start)},'计划截止时间':{date:timelineISO(ds,end,true)}};}
function duration(ms){const s=Math.max(0,Math.floor(ms/1000));if(!s)return '0分钟';if(s<60)return s+'秒';const m=Math.floor(s/60);return m>=60?Math.floor(m/60)+'小时'+(m%60?m%60+'分':''):m+'分钟';}
function clock(ms){const s=Math.max(0,Math.floor(ms/1000));return pad(Math.floor(s/3600))+':'+pad(Math.floor(s/60)%60)+':'+pad(s%60);}
function toLocal(iso){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';return localDay(d)+'T'+pad(d.getHours())+':'+pad(d.getMinutes());}
function fromLocal(s){const d=new Date(s);if(!Number.isFinite(d.getTime()))throw Error('请输入有效日期和时间');return d.toISOString();}
function validateInterval(a,b,now=Date.now()){const start=stamp(a),end=stamp(b);if(!Number.isFinite(start)||!Number.isFinite(end))throw Error('请输入有效的起止时间');if(end<=start)throw Error('结束时间必须晚于开始时间');if(end>now+60000)throw Error('结束时间不能在未来');return {start,end};}
function inline(raw){
 let tokens=[];const hold=s=>'\uE000'+(tokens.push(s)-1)+'\uE001';
 let text=String(raw).replace(/[\uE000\uE001]/g,'').replace(/`([^`]+)`/g,(_,s)=>hold('<code>'+esc(s)+'</code>'));
 text=text.replace(/(!?)\[([^\]\n]*)\]\(([^\s)]+)\)/g,(_,image,label,url)=>{const safe=B.safeURL(url,!!image);if(!safe)return label;return hold(image?'<img loading="lazy" alt="'+esc(label)+'" src="'+esc(safe)+'">':'<a href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>');});
 text=esc(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/~~([^~]+)~~/g,'<s>$1</s>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
 return text.replace(/\uE000(\d+)\uE001/g,(_,i)=>tokens[+i]||'');
}
function markdown(raw){
 const lines=String(raw||'').replace(/\r\n?/g,'\n').split('\n');let out=[],code=null,lists=[],table=false;
 const closeLists=()=>{while(lists.length){out.push('</li></'+lists.pop().kind+'>');}};
 const close=()=>{closeLists();if(table){out.push('</tbody></table></div>');table=false;}};
 for(let i=0;i<lines.length;i++){const s=lines[i];if(/^\s*```/.test(s)){close();if(code!==null){out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');code=null;}else code=[];continue;}if(code!==null){code.push(s);continue;}
  let m=s.match(/^(#{1,4})\s+(.*)$/);if(m){close();out.push('<h'+m[1].length+'>'+inline(m[2])+'</h'+m[1].length+'>');continue;}
  m=s.match(/^(\s*)([-*+]|\d+\.)\s+(?:\[([ xX])\]\s*)?(.*)$/);if(m){
   const indent=m[1].replace(/\t/g,'  ').length,kind=/\d/.test(m[2])?'ol':'ul',check=m[3]!==undefined;
   if(table){out.push('</tbody></table></div>');table=false;}
   while(lists.length&&indent<lists.at(-1).indent)out.push('</li></'+lists.pop().kind+'>');
   if(lists.length&&indent===lists.at(-1).indent&&kind!==lists.at(-1).kind)out.push('</li></'+lists.pop().kind+'>');
   if(!lists.length||indent>lists.at(-1).indent){lists.push({indent,kind});out.push('<'+kind+(kind==='ol'&&parseInt(m[2],10)!==1?' start="'+parseInt(m[2],10)+'"':'')+'>');}
   else out.push('</li>');
   out.push('<li data-md-line="'+i+'">'+(check?'<button type="button" class="md-check '+(m[3]!==' '?'checked':'')+'" data-act="check-line" data-line="'+i+'" aria-label="'+(m[3]!==' '?'取消勾选':'勾选')+'">'+(m[3]!==' '?'✓':'')+'</button><span>'+inline(m[4])+'</span>':inline(m[4])));continue;
  }
  if(s.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){close();let cells=s.trim().replace(/^\||\|$/g,'').split('|');out.push('<div class="table-scroll"><table><thead><tr>'+cells.map(c=>'<th>'+inline(c.trim())+'</th>').join('')+'</tr></thead><tbody>');table=true;i++;continue;}
  if(table&&s.includes('|')){out.push('<tr>'+s.trim().replace(/^\||\|$/g,'').split('|').map(c=>'<td>'+inline(c.trim())+'</td>').join('')+'</tr>');continue;}
  close();if(/^\s*>/.test(s)){out.push('<blockquote>'+inline(s.replace(/^\s*>\s?/,''))+'</blockquote>');continue;}if(/^\s*---+\s*$/.test(s)){out.push('<hr>');continue;}if(s.trim())out.push('<p>'+inline(s)+'</p>');else out.push('');
 }close();if(code!==null)out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');return out.join('\n');
}
function toggleCheck(s,line){let a=s.split('\n');if(a[line])a[line]=a[line].replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/,(_,l,c,r)=>l+(c===' '?'x':' ')+r);return a.join('\n');}
function plain(s){return String(s||'').replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*_`~>|]/g,'').replace(/\[[ xX]\]/g,'').replace(/\s+/g,' ').trim();}
function taskTitle(markdown){return String(markdown||'').trimStart().split(/\r?\n/,1)[0].replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)/,'').replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*/g,(_,a,b,c,d,e)=>a||b||c||d||e).trim().slice(0,300);}
function taskContent(task){const title=String(task?.['任务标题']||''),body=String(task?.['任务详情']??task?.['任务描述']??'');return !body.trim()?title:!title.trim()||taskTitle(body)===title.trim()?body:title+'\n\n'+body;}
return {...B,STATUS,LABEL,id,esc,stamp,terminal,day,localDay,merge,taskTime,summary,weekDays,monthDays,shiftMonth,onDay,movePlan,planMinute,snapMinute,timelineRange,taskEstimateMinutes,isParallel,timelineLayout,timelineConflicts,timelinePlan,scheduleScope,schedulePlan,reorder,calendarLabel,timelineMove,timelineResize,timelinePatch,duration,clock,toLocal,fromLocal,validateInterval,markdown,toggleCheck,plain,taskTitle,taskContent};
});
