/* Work reviews use recorded activity, not planned dates as evidence of work. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));
 else{const reports=factory(root.OneDayLiteCore);root.OneDayLiteReports=reports;reports.attach(root.OneDayLite);}
})(typeof window!=='undefined'?window:this,function(C){
'use strict';
const DAY=86400000,OFFSET=8*3600000;
const PERIODS={week:'周报',month:'月度回顾',quarter:'季度总结',half:'半年总结',year:'年度总结',custom:'工作回顾'};
const chinaDay=(time=Date.now())=>new Date(time+OFFSET).toISOString().slice(0,10);
const dayStamp=day=>Date.parse(day+'T00:00:00+08:00');

function periodRange(period='week',anchor=chinaDay(),custom={}){
 if(!Object.prototype.hasOwnProperty.call(PERIODS,period))throw Error('请选择有效的统计周期');
 if(!C.validDate(anchor))throw Error('统计日期无效');
 let start,end,next,previous,label;
 const year=Number(anchor.slice(0,4)),month=Number(anchor.slice(5,7));
 if(period==='custom'){
  if(!C.validDate(custom.start)||!C.validDate(custom.end))throw Error('请选择有效的开始和结束日期');
  if(custom.end<custom.start)throw Error('结束日期不能早于开始日期');
  start=custom.start;end=custom.end;const days=Math.round((dayStamp(end)-dayStamp(start))/DAY)+1;
  previous=C.plusDays(start,-days);next=C.plusDays(end,1);label='自选时间';
 }else if(period==='week'){
  const weekday=(new Date(anchor+'T12:00:00Z').getUTCDay()+6)%7;
  start=C.plusDays(anchor,-weekday);end=C.plusDays(start,6);previous=C.plusDays(start,-7);next=C.plusDays(start,7);label=start+' — '+end;
 }else{
  const months=period==='month'?1:period==='quarter'?3:period==='half'?6:12;
  const first=period==='year'?1:Math.floor((month-1)/months)*months+1;
  start=year+'-'+String(first).padStart(2,'0')+'-01';
  const after=new Date(Date.UTC(year,first-1+months,1)),before=new Date(Date.UTC(year,first-1-months,1));
  next=after.toISOString().slice(0,10);previous=before.toISOString().slice(0,10);end=C.plusDays(next,-1);
  label=period==='month'?year+'年'+month+'月':period==='quarter'?year+'年第'+(Math.floor((month-1)/3)+1)+'季度':period==='half'?year+'年'+(first===1?'上半年':'下半年'):year+'年';
 }
 const endExclusive=C.plusDays(end,1);
 return {period,start,end,endExclusive,from:dayStamp(start),to:dayStamp(endExclusive),previousAnchor:previous,nextAnchor:next,label,title:PERIODS[period]};
}

function buildReport(data,range,now=Date.now()){
 const inRange=time=>Number.isFinite(time)&&time>=range.from&&time<range.to&&time<=now;
 const notes=data.notes.map(note=>{
  const created=C.stamp(note['创建时间']),modified=C.stamp(note['更新时间']);
  const at=Number.isFinite(modified)?modified:created;
  return {id:C.id(note),note,taskId:note['关联任务ID']||'',body:note['便签内容']||'',category:note['便签分类']||'记录',at,date:Number.isFinite(at)?chinaDay(at):'',updated:at!==created};
 }).filter(note=>inRange(note.at)).sort((a,b)=>b.at-a.at);
 const notesByTask=new Map(),tagsByTask=new Map();
 for(const note of notes)if(note.taskId){if(!notesByTask.has(note.taskId))notesByTask.set(note.taskId,[]);notesByTask.get(note.taskId).push(note);}
 for(const link of data.links){const id=link['任务ID'],tag=link['标签名称'];if(!tag)continue;if(!tagsByTask.has(id))tagsByTask.set(id,new Set());tagsByTask.get(id).add(tag);}
 let intervals=[],totalMs=0;
 const today=chinaDay(now),rows=data.tasks.map(task=>{
  const id=C.id(task),status=task['任务状态']||C.STATUS[0],trashed=!!task['回收站'];
  const deleted=C.stamp(task['删除时间']),time=C.taskTime(task,data.logs,trashed&&Number.isFinite(deleted)?Math.min(now,deleted):now,[range.from,range.to]);
  const created=C.stamp(task['创建时间']),changed=C.stamp(task['状态开始时间']);
  const completedAt=status==='完成'?C.stamp(task['状态结束时间']||task['状态开始时间']):NaN,completedInRange=inRange(completedAt);
  const linked=notesByTask.get(id)||[],createdInRange=inRange(created),statusChangedInRange=inRange(changed);
  const a=C.day(task['计划开始时间']||task['计划截止时间']),b=C.day(task['计划截止时间']||task['计划开始时间']);
  const plannedInRange=!!a&&a<=range.end&&b>=range.start;
  const active=time.doing>0||linked.length>0||completedInRange||createdInRange||statusChangedInRange;
  const row={id,task,title:task['任务标题']||'未命名记录',status,trashed,ms:time.doing,notes:linked,tags:[...(tagsByTask.get(id)||[])],completedAt,completedDate:Number.isFinite(completedAt)?chinaDay(completedAt):'',completedInRange,created,createdInRange,changed,statusChangedInRange,plannedInRange,active,deadlineDate:C.day(task['最后期限']||task['计划截止时间']),issues:time.issues};
  intervals.push(...time.intervals);totalMs+=time.doing;return row;
 });
 const merged=C.merge(intervals),uniqueMs=merged.reduce((sum,[a,b])=>sum+b-a,0),active=rows.filter(row=>row.active);
 const completed=rows.filter(row=>row.completedInRange).sort((a,b)=>b.completedAt-a.completedAt);
 const byEffort=(a,b)=>b.ms-a.ms||b.notes.length-a.notes.length||a.title.localeCompare(b.title,'zh-CN');
 const progress=rows.filter(row=>!row.trashed&&(row.active||row.plannedInRange)&&['进行中','暂停'].includes(row.status)).sort(byEffort);
 const pending=rows.filter(row=>!row.trashed&&(row.active||row.plannedInRange)&&row.status===C.STATUS[0]).sort(byEffort);
 const ended=rows.filter(row=>row.status===C.STATUS[4]&&row.statusChangedInRange);
 const otherActivity=active.filter(row=>!row.completedInRange&&C.terminal(row.status)&&(row.ms>0||row.notes.length>0)&&!(row.status===C.STATUS[4]&&row.statusChangedInRange)).sort(byEffort);
 const risks=rows.filter(row=>!row.trashed&&!C.terminal(row.status)&&(row.active||row.plannedInRange)&&row.deadlineDate&&row.deadlineDate<today).sort((a,b)=>a.deadlineDate.localeCompare(b.deadlineDate));
 const nextStart=range.endExclusive,nextEnd=C.plusDays(nextStart,6);
 const upcoming=rows.filter(row=>{const date=C.day(row.task['计划开始时间'])||row.deadlineDate;return !row.trashed&&!C.terminal(row.status)&&date>=nextStart&&date<=nextEnd;}).sort((a,b)=>String(a.task['计划开始时间']||a.deadlineDate).localeCompare(String(b.task['计划开始时间']||b.deadlineDate)));
 const activityDates=new Set();
 for(const note of notes)activityDates.add(note.date);
 for(const row of active){if(row.createdInRange)activityDates.add(chinaDay(row.created));if(row.statusChangedInRange)activityDates.add(chinaDay(row.changed));if(row.completedInRange)activityDates.add(row.completedDate);}
 const trend=[];
 for(let date=range.start;date<=range.end;date=C.plusDays(date,1)){
  const a=dayStamp(date),b=a+DAY,ms=merged.reduce((sum,[start,end])=>sum+Math.max(0,Math.min(end,b)-Math.max(start,a)),0);
  if(ms>0)activityDates.add(date);
  trend.push({date,ms,completed:completed.filter(row=>row.completedDate===date).length,notes:notes.filter(note=>note.date===date).length,active:activityDates.has(date)});
 }
 const tagMap=new Map(),categoryMap=new Map();
 for(const row of active)for(const name of row.tags.length?row.tags:['未加标签']){const tag=tagMap.get(name)||{name,count:0,ms:0};tag.count++;tag.ms+=row.ms;tagMap.set(name,tag);}
 for(const note of notes){const category=categoryMap.get(note.category)||{name:note.category,count:0};category.count++;categoryMap.set(note.category,category);}
 return {range,now,today,rows,active,completed,progress,pending,ended,otherActivity,risks,upcoming,nextStart,nextEnd,notes,trend,uniqueMs,totalMs,overlapMs:Math.max(0,totalMs-uniqueMs),taskCount:active.length,completedCount:completed.length,activeDays:activityDates.size,noteCount:notes.length,createdCount:rows.filter(row=>row.createdInRange).length,unloggedCompleted:completed.filter(row=>!row.ms).length,tags:[...tagMap.values()].sort((a,b)=>b.ms-a.ms||b.count-a.count),categories:[...categoryMap.values()].sort((a,b)=>b.count-a.count),issues:active.filter(row=>row.issues.length),hasActivity:active.length>0||notes.length>0};
}

function reportMarkdown(report){
 const {range}=report;
 const detail=row=>row.title+(row.trashed?'（已移入回收站，保留历史）':'')+(row.tags.length?' · '+row.tags.map(tag=>'#'+tag).join(' '):'')+'；'+(row.ms?'本期执行 '+C.duration(row.ms):'未记录执行时长');
 const lines=['# '+(range.period==='week'?range.start+' — '+range.end:range.label)+' · '+range.title,'','统计区间：'+range.start+' 至 '+range.end+'（北京时间 UTC+08:00）','','## 本期概览','',
  '- 可确认完成：'+report.completedCount+' 项（按当前完成状态及实际完成时间）。',
  '- 有活动的任务：'+report.taskCount+' 项；新建 '+report.createdCount+' 项；新增或更新记录 '+report.noteCount+' 条。',
  '- 记录的执行用时：'+C.duration(report.uniqueMs)+'，跨任务及父子任务重叠已去重。',
  '- 有活动的日期：'+report.activeDays+' 天（含执行、创建、状态变化或记录更新）。'];
 if(report.overlapMs)lines.push('- 各任务累计 '+C.duration(report.totalMs)+'，其中并行重叠 '+C.duration(report.overlapMs)+'。');
 if(!report.uniqueMs)lines.push('- 本期没有记录到执行时段；计划时长未当作实际工时。');
 lines.push('','## 已完成','');
 if(report.completed.length)for(const row of report.completed)lines.push('- '+detail(row)+'；完成于 '+row.completedDate+'。');
 else lines.push('- 本期没有可确认的完成记录。');
 lines.push('','## 推进中与待跟进','');
 if(report.progress.length)for(const row of report.progress)lines.push('- '+detail(row)+'；当前'+(row.status==='暂停'?'已暂停':'进行中')+'。');
 else lines.push('- 本期没有记录到当前进行中或暂停的任务。');
 if(report.pending.length){lines.push('','### 待开始 / 本期计划','');for(const row of report.pending)lines.push('- '+row.title+'；'+(row.task['计划开始时间']?'计划 '+C.day(row.task['计划开始时间']):'尚未安排时间')+'。');}
 if(report.otherActivity.length){lines.push('','### 其他有投入的任务','');for(const row of report.otherActivity)lines.push('- '+detail(row)+'；当前'+(row.status==='完成'?'已完成（完成时间不在本期）':'已结束但未完成')+(row.completedDate?'，完成于 '+row.completedDate:'')+'。');}
 if(report.ended.length){lines.push('','### 已结束但未完成','');for(const row of report.ended)lines.push('- '+detail(row)+'。');}
 lines.push('','## 工作记录摘录','');
 if(report.notes.length)for(const note of report.notes){const row=report.rows.find(row=>row.id===note.taskId);lines.push('### '+note.date+' · '+note.category+(note.updated?'（本期更新）':'')+(row?' · '+row.title:''),'',...note.body.split('\n').map(line=>'> '+line),'');}
 else lines.push('- 本期没有新增或更新的文字记录。');
 lines.push('','## 风险与待确认（截至 '+report.today+'）','');
 if(report.risks.length)for(const row of report.risks)lines.push('- '+row.title+'：原截止 '+row.deadlineDate+'，当前仍未完成；请核对进展或调整计划。');
 else lines.push('- 根据当前记录，未发现本期相关任务已经逾期且仍未完成；其他风险需自行补充。');
 lines.push('','## 下一步（按已有安排）','','范围：'+report.nextStart+' 至 '+report.nextEnd+'；计划不代表已经完成。','');
 if(report.upcoming.length)for(const row of report.upcoming)lines.push('- '+(C.day(row.task['计划开始时间'])||row.deadlineDate)+' · '+row.title+'。');
 else lines.push('- 这段时间尚无已安排且未完成的任务，请补充下一步。');
 lines.push('','## 补充总结','','（可补充业务成果、关键结论、协作反馈和需要支持的事项。）','','---','统计说明：只汇总已有任务、时间日志及文字记录。执行时间取「进行中」区间并去重，不将计划时长计为实际投入。当前状态不能完整还原历史时点；已完成后又重新打开的任务不推测为历史完成。已删除任务的已有活动保留并标注。');
 return lines.join('\n').replace(/\n{3,}/g,'\n\n');
}

function attach(L){
 const E=C.esc;
 const savedPeriod=L.read('report.period','week');
 const state=L.UI.report={period:Object.prototype.hasOwnProperty.call(PERIODS,savedPeriod)?savedPeriod:'week',anchor:chinaDay(),customStart:chinaDay().slice(0,7)+'-01',customEnd:chinaDay(),list:'active',preview:false,drafts:new Map(),draftSaveFailed:false,focus:null};
 function taskList(rows,empty){
  return rows.length?'<div class="report-task-list">'+rows.map(row=>'<button class="report-task" data-report-task="'+E(row.id)+'"><span class="report-task-main"><strong>'+E(row.title)+'</strong><span>'+E(row.completedInRange?'完成于 '+row.completedDate:L.statusLabel?.(row.status)||row.status)+(row.trashed?' · 已移入回收站':'')+(row.tags.length?' · '+E(row.tags.map(tag=>'#'+tag).join(' ')):'')+'</span></span><span class="report-task-time">'+(row.ms?E(C.duration(row.ms)):'未记时')+'</span>'+L.icon('chevronRight',14)+'</button>').join('')+'</div>':'<div class="report-empty">'+empty+'</div>';
 }
 L.renderReports=function(){
  const range=periodRange(state.period,state.anchor,{start:state.customStart,end:state.customEnd}),report=buildReport(L.store.data,range),key='report.draft.'+range.start+'.'+range.end;
  state.report=report;state.key=key;
  if(!state.drafts.has(key)){const saved=L.read(key,null);state.drafts.set(key,typeof saved==='string'?saved:null);}
  const edited=state.drafts.get(key)!==null,draft=edited?state.drafts.get(key):reportMarkdown(report);
  let buckets=report.trend;
  if(report.trend.length>40){const weeks=new Map();for(const day of report.trend){const week=C.weekDays(day.date)[0],item=weeks.get(week)||{date:day.date,end:day.date,ms:0,completed:0,notes:0};item.end=day.date;item.ms+=day.ms;item.completed+=day.completed;item.notes+=day.notes;weeks.set(week,item);}buckets=[...weeks.values()];}
  const max=Math.max(...buckets.map(day=>day.ms),1),step=860/buckets.length,barWidth=Math.max(.7,Math.min(28,step*.64));
  const chart='<svg class="report-trend-chart" viewBox="0 0 880 172" role="img" aria-label="'+E((report.trend.length>40?'每周':'每日')+'执行用时，已去重')+'"><line x1="10" x2="870" y1="140" y2="140" class="report-chart-baseline"/>'+buckets.map((day,i)=>{const height=day.ms/max*108,x=10+step*(i+.5)-barWidth/2;return '<g><title>'+E(day.date+(day.end&&day.end!==day.date?' 至 '+day.end:'')+'：执行 '+C.duration(day.ms)+'；完成 '+day.completed+' 项；记录 '+day.notes+' 条')+'</title><rect class="report-chart-bar '+(day.ms?'':'is-empty')+'" x="'+x.toFixed(2)+'" y="'+(140-Math.max(height,2)).toFixed(2)+'" width="'+barWidth.toFixed(2)+'" height="'+Math.max(height,2).toFixed(2)+'" rx="'+Math.min(4,barWidth/2).toFixed(2)+'"/></g>';}).join('')+'<text x="10" y="163">'+range.start.slice(5)+'</text><text x="870" y="163" text-anchor="end">'+range.end.slice(5)+'</text></svg>';
  const listGroups={active:report.active,completed:report.completed,progress:report.progress,pending:report.pending,notes:report.notes},listLabels={active:'全部活动',completed:'已完成',progress:'推进中',pending:'待开始',notes:'文字记录'};
  const tagMax=Math.max(...report.tags.map(tag=>tag.ms),1),tags=report.tags.slice(0,6);
  let evidence=state.list==='notes'?(report.notes.length?'<div class="report-note-list">'+report.notes.map(note=>'<button class="report-note" data-report-note="'+E(note.id)+'"><span class="report-note-meta">'+E(note.date+' · '+note.category+(note.updated?' · 本期更新':''))+'</span><strong>'+E(C.plain(note.body).slice(0,180))+'</strong></button>').join('')+'</div>':'<div class="report-empty">本期还没有新增或更新的文字记录。</div>'):taskList(listGroups[state.list],'这个时间范围内，没有相应的任务记录。');
  return '<section class="reports-workspace" aria-label="工作统计与回顾"><header class="report-heading"><div><span class="report-eyebrow">把做过的事，连成一条线</span><h1>工作回顾</h1><p>从真实记录开始，整理你的'+range.title+'。</p></div><div class="report-heading-actions"><span class="report-zone">北京时间 · UTC+08:00</span><button class="button outline" data-report-action="jump-draft">'+L.icon('edit',14)+'整理'+range.title+'</button></div></header>'+
   '<div class="report-period-toolbar"><div class="report-periods" role="group" aria-label="统计周期">'+[['week','周'],['month','月'],['quarter','季度'],['half','半年'],['year','全年'],['custom','自选']].map(([period,label])=>'<button data-report-period="'+period+'" class="'+(state.period===period?'on':'')+'" aria-pressed="'+(state.period===period)+'">'+label+'</button>').join('')+'</div><div class="report-range-nav"><button class="icon-button small" data-report-action="previous" aria-label="上一统计周期">'+L.icon('chevronLeft',16)+'</button><div><strong>'+E(range.label)+'</strong><span>'+range.start+' — '+range.end+'</span></div><button class="icon-button small" data-report-action="next" aria-label="下一统计周期">'+L.icon('chevronRight',16)+'</button><button class="text-button" data-report-action="current">本期</button></div></div>'+
   (state.period==='custom'?'<form class="report-custom-range" data-report-custom><label>开始日期<input class="input" type="date" name="start" value="'+range.start+'" required></label><span>至</span><label>结束日期<input class="input" type="date" name="end" value="'+range.end+'" required></label><button class="button" type="submit">应用</button></form>':'')+
   '<div class="report-metrics"><article class="report-metric is-primary"><span>完成任务</span><strong>'+report.completedCount+'<small>项</small></strong><p>按实际完成时间归入本期</p></article><article class="report-metric"><span>记录的执行用时</span><strong class="report-duration">'+E(C.duration(report.uniqueMs))+'</strong><p>并行、父子任务重叠已去重</p></article><article class="report-metric"><span>有活动的任务</span><strong>'+report.taskCount+'<small>项</small></strong><p>'+report.createdCount+' 项新建 · '+report.noteCount+' 条文字记录</p></article><article class="report-metric"><span>有活动的日期</span><strong>'+report.activeDays+'<small>天</small></strong><p>执行、创建、状态变化或记录更新</p></article></div>'+
   '<div class="report-overview-grid"><section class="report-panel report-trend"><div class="report-panel-heading"><div><h2>投入的节奏</h2><p>'+(report.trend.length>40?'按周汇总':'每日执行')+' · '+(report.uniqueMs?(report.trend.length>40?'单周最高 ':'单日最高 ')+E(C.duration(max)):'开始计时后，会留下真实的投入轨迹')+'</p></div><span class="report-legend"><i></i>实际执行</span></div>'+chart+'<p class="report-footnote">计划时长不计入实际投入。'+(report.overlapMs?'各任务累计 '+E(C.duration(report.totalMs))+'，其中重叠 '+E(C.duration(report.overlapMs))+'。':'暂停与等待不计时。')+'</p></section><section class="report-panel report-distribution"><div class="report-panel-heading"><div><h2>精力放在哪里</h2><p>按任务标签 · 多标签任务可重复归类</p></div></div>'+(tags.length?'<div class="report-tag-bars">'+tags.map(tag=>'<div class="report-tag-row"><div><span>'+E(tag.name)+'</span><strong>'+E(tag.ms?C.duration(tag.ms):tag.count+' 项活动')+'</strong></div><i><b style="width:'+(tag.ms/tagMax*100).toFixed(1)+'%"></b></i></div>').join('')+'</div>':'<div class="report-empty">给任务加上标签，回顾时就能看见投入的方向。</div>')+'<div class="report-category-chips">'+report.categories.map(category=>'<span>'+E(category.name)+' <b>'+category.count+'</b></span>').join('')+'</div></section></div>'+
   '<section class="report-panel report-evidence"><div class="report-panel-heading"><div><h2>本期发生了什么</h2><p>点击一条记录，回到具体内容。</p></div><span class="report-evidence-count">'+(report.hasActivity?'已有记录可供整理':'这一期还很安静')+'</span></div><div class="report-evidence-tabs" role="tablist" aria-label="本期活动">'+Object.entries(listLabels).map(([key,label])=>'<button role="tab" aria-selected="'+(state.list===key)+'" class="'+(state.list===key?'on':'')+'" data-report-list="'+key+'">'+label+'<span>'+listGroups[key].length+'</span></button>').join('')+'</div><div class="report-evidence-body">'+evidence+'</div></section>'+
   (report.risks.length?'<aside class="report-risk-note">'+L.icon('clock',16)+'<span>截至 '+report.today+'，本期相关任务有 <strong>'+report.risks.length+' 项</strong>已过截止日期且仍未完成。已列入下方草稿，方便逐项核对。</span></aside>':'')+
   '<section class="report-panel report-draft" id="reportDraftPanel"><div class="report-panel-heading"><div><span class="report-eyebrow">记录 → 复盘 → 下一步</span><h2>'+range.title+'草稿</h2><p>由已有记录整理，可继续补充成果与结论；草稿保存在此设备。</p></div><div class="report-draft-actions"><button class="text-button" data-report-action="preview" aria-pressed="'+state.preview+'">'+(state.preview?'编辑':'预览')+'</button><button class="text-button" data-report-action="regenerate">重新生成</button><button class="button outline" data-report-action="export">'+L.icon('download',14)+'导出</button><button class="button primary" data-report-action="copy">'+L.icon('copy',14)+'复制</button></div></div><div class="report-draft-status" data-report-draft-status aria-live="polite">'+(edited?(state.draftSaveFailed?'编辑暂留在当前页面，请及时复制或导出':'已保留你的编辑'):'根据当前数据生成 · 尚未编辑')+'</div><textarea class="report-draft-editor" data-report-draft aria-label="'+E(range.title)+' Markdown 草稿" spellcheck="false" '+(state.preview?'hidden':'')+'>'+E(draft)+'</textarea><div class="report-preview md-preview" '+(state.preview?'':'hidden')+'>'+C.markdown(draft)+'</div></section>'+
   '<footer class="report-method">统计口径：完成按当前完成状态和实际完成时间；历史状态无法完整还原。已移入回收站的已有活动仍保留并标注。'+(report.issues.length?'本期 '+report.issues.length+' 项任务存在时间日志提示，可在任务日志中核对。':'')+'</footer></section>';
 };
 L.mountReports=function(container){
  const textarea=container.querySelector('[data-report-draft]'),key=state.key;
  const saveDraft=()=>{state.drafts.set(key,textarea.value);state.draftSaveFailed=L.save(key,textarea.value)===false;const status=container.querySelector('[data-report-draft-status]');if(status)status.textContent=state.draftSaveFailed?'编辑暂留在当前页面，请及时复制或导出':'已保留你的编辑';};
  const input=e=>{if(e.target===textarea)saveDraft();};
  const submit=e=>{const form=e.target.closest('[data-report-custom]');if(!form)return;e.preventDefault();try{const custom={start:form.elements.start.value,end:form.elements.end.value};periodRange('custom',state.anchor,custom);state.customStart=custom.start;state.customEnd=custom.end;L.render();}catch(error){L.handleError(error);}};
  const click=async e=>{
   const target=e.target.closest('[data-report-action],[data-report-period],[data-report-list],[data-report-task],[data-report-note]');if(!target)return;e.preventDefault();
   if(target.dataset.reportTask){const row=state.report.rows.find(row=>row.id===target.dataset.reportTask);if(row?.trashed){L.toast('这条任务已移入回收站，恢复后可以继续编辑。',{label:'查看回收站',run:()=>L.openRecycle()});return;}return L.openTask(target.dataset.reportTask);}
   if(target.dataset.reportNote)return L.openNote(target.dataset.reportNote);
   if(target.dataset.reportPeriod){state.period=target.dataset.reportPeriod;L.save('report.period',state.period);L.render();return;}
   if(target.dataset.reportList){state.list=target.dataset.reportList;L.render();return;}
   const action=target.dataset.reportAction,range=state.report.range;
   if(action==='previous'||action==='next'){
    const direction=action==='previous'?-1:1;
    if(state.period==='custom'){const days=Math.round((range.to-range.from)/DAY);state.customStart=C.plusDays(range.start,days*direction);state.customEnd=C.plusDays(range.end,days*direction);}else state.anchor=direction<0?range.previousAnchor:range.nextAnchor;
    L.render();return;
   }
   if(action==='current'){state.anchor=chinaDay();if(state.period==='custom'){state.customStart=state.anchor.slice(0,7)+'-01';state.customEnd=state.anchor;}L.render();return;}
   if(action==='jump-draft'){container.querySelector('#reportDraftPanel').scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return;}
   if(action==='preview'){state.preview=!state.preview;L.render();return;}
   if(action==='regenerate'){
    if(state.drafts.get(key)!==null&&!await L.confirm('重新生成这份草稿？','这会用当前记录替换你对本期草稿的编辑。需要保留时，请先复制或导出。','重新生成'))return;
    state.drafts.set(key,null);L.remove(key);state.preview=false;L.render();return;
   }
   const value=textarea.value;
   if(action==='export'){L.download('OneDay-'+range.title+'-'+range.start+'_'+range.end+'.md',value,'text/markdown;charset=utf-8');L.toast('已导出 '+range.title+' Markdown');return;}
   if(action==='copy'){
    try{await navigator.clipboard.writeText(value);L.toast('已复制，可以粘贴到周报或工作总结');}
    catch(error){state.preview=false;textarea.hidden=false;const preview=container.querySelector('.report-preview');if(preview)preview.hidden=true;const toggle=container.querySelector('[data-report-action="preview"]');toggle.textContent='预览';toggle.setAttribute('aria-pressed','false');textarea.focus();textarea.select();let copied=false;try{copied=document.execCommand('copy');}catch(_){}L.toast(copied?'已复制，可以粘贴到周报或工作总结':'已选中草稿，请使用复制操作或按 Ctrl/Cmd+C。');}
   }
  };
  container.addEventListener('input',input);container.addEventListener('submit',submit);container.addEventListener('click',click);
  if(state.focus?.key===key&&!state.preview){textarea.focus({preventScroll:true});textarea.setSelectionRange(state.focus.start,state.focus.end);textarea.scrollTop=state.focus.scroll;state.focus=null;}
  return {destroy(){if(document.activeElement===textarea){state.focus={key,start:textarea.selectionStart,end:textarea.selectionEnd,scroll:textarea.scrollTop};if(state.drafts.get(key)!==null)saveDraft();}container.removeEventListener('input',input);container.removeEventListener('submit',submit);container.removeEventListener('click',click);}};
 };
}
return {periodRange,buildReport,reportMarkdown,attach,chinaDay};
});
