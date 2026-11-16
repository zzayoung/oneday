/* OneDay Lite 1.3 Day Sheet: one daily workspace, timeline + directly editable task detail. */
(function(){'use strict';
const L=window.OneDayLite,{C,icon}=L,E=C.esc,HOUR=48,DAY=HOUR*24,SNAP=10;
const fmt=min=>String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
const cyclicIndex=(index,count)=>((index%count)+count)%count;
function rangeLabel(start,end){
 const clock=minute=>fmt(cyclicIndex(minute,1440)),relative=offset=>offset===-1?'前日':offset===1?'次日':Math.abs(offset)+'天'+(offset<0?'前':'后');
 const context=[Math.floor(start/1440),Math.floor(end/1440)].map((offset,index)=>offset?relative(offset)+(index?'结束':'开始'):'').filter(Boolean);
 return clock(start)+'–'+clock(end)+(context.length?' · '+context.join('，'):'');
}
const planInput=v=>String(v||'').slice(0,16);
const inputISO=v=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)?v+':00Z':'';
// A Day Sheet keeps one draft session per visited task, including editors whose uploads outlive a repaint.
L.createDayDrafts=function(onPaint=()=>{}){
 const sessions=new Map(),editors=new Map(),worklogs=new Map(),worklogFlights=new Map();
 let active=null,worklogInput=null,disposed=false,closing=null;
 function session(id){
  if(!sessions.has(id)){
   const task=L.find(id);if(!task)throw Error('任务不存在，请重新读取。');
   const current=L.draftSession('tasks',id,{'任务标题':task['任务标题']||'','任务详情':C.taskContent(task)},state=>{
    for(const [editor,taskId]of editors)if(taskId===id){if(editor.getValue()!==state.values['任务详情'])editor.setValue(state.values['任务详情']);editor.setReadOnly(!!state.draft);}
    onPaint(id,state);
   },{unifiedContent:true});sessions.set(id,current);
  }
  return sessions.get(id);
 }
 function changeBody(id,value,source){
  const current=session(id),before=current.values['任务详情'];
  if(source&&active?.id===id&&active.editor!==source){
   // A retired upload appends to its buffer; first capture any newer DOM text in the visible editor.
   const prefix=String(before||''),suffix=value.startsWith(prefix)?value.slice(prefix.length):null;
   active.editor.flush();const latest=current.values['任务详情'];
   if(latest!==before&&suffix!==null)value=latest+(latest&&suffix&&!suffix.startsWith('\n')?'\n\n':'')+suffix;
  }
  current.change('任务详情',value);
 }
 function releaseEditor(){if(!active)return;const editor=active.editor;editor.flush();editor.destroy();active=null;if(!editor.pendingUploads)editors.delete(editor);}
 function worklogValue(id){if(worklogInput?.id===id)return worklogInput.area.value;if(!worklogs.has(id))worklogs.set(id,L.read('worklog.'+id,''));return worklogs.get(id);}
 function changeWorklog(id,value){value=String(value??'');worklogs.set(id,value);if(value)return L.save('worklog.'+id,value);L.remove('worklog.'+id);return true;}
 function captureWorklog(){return worklogInput?changeWorklog(worklogInput.id,worklogInput.area.value):true;}
 function flushLocal(){
  const previous=L.capturingDrafts;L.capturingDrafts=true;let saved=true;
  const capture=fn=>{try{if(fn()===false)saved=false;}catch(e){saved=false;}};
  try{capture(()=>active?.editor.flush());capture(captureWorklog);for(const [id,value]of worklogs)capture(()=>changeWorklog(id,value));for(const current of sessions.values())capture(()=>current.flushLocal());}
  finally{L.capturingDrafts=previous;}
  return saved;
 }
 async function submitWorklog(id){
  if(worklogFlights.has(id))return worklogFlights.get(id);
  const snapshot=worklogValue(id);if(!snapshot.trim())return false;changeWorklog(id,snapshot);
  const flight=(async()=>{
   try{await L.store.addWorklog(id,snapshot.trim());const latest=worklogValue(id);if(latest===snapshot){changeWorklog(id,'');if(worklogInput?.id===id&&worklogInput.area.value===snapshot)worklogInput.area.value='';}else changeWorklog(id,latest);return true;}
   catch(e){changeWorklog(id,worklogValue(id));throw e;}
  })();worklogFlights.set(id,flight);try{return await flight;}finally{worklogFlights.delete(id);}
 }
 const unregister=L.registerDraftSource({flushLocal,isDirty:()=>!!worklogFlights.size||!!worklogInput?.area.value.trim()||[...worklogs.values()].some(value=>value.trim())||[...editors.keys()].some(editor=>editor.pendingUploads>0)});
 async function finishClose(confirmClose){
  flushLocal();
  const ready=await Promise.allSettled([...editors.keys()].map(editor=>editor.whenReady()).concat([...worklogFlights.values()]));
  const saved=await Promise.allSettled([...sessions.values()].map(current=>current.flush()));
  const failure=ready.concat(saved).find(result=>result.status==='rejected');
  if(!flushLocal()){L.toast('还有内容未能写入本机草稿，请先复制当前输入后再关闭。',null,true);return false;}
  if(failure&&!await confirmClose(failure.reason))return false;
  for(const editor of editors.keys())editor.destroy();for(const current of sessions.values())current.dispose();
  active=null;worklogInput=null;editors.clear();unregister();disposed=true;return true;
 }
 return {session,changeBody,releaseEditor,changeWorklog,submitWorklog,flushLocal,
  async flushTask(id){for(const [editor,taskId]of editors)if(taskId===id){editor.flush();await editor.whenReady();}if(!flushLocal())throw Error('当前内容未能写入本机草稿，请先复制内容。');await session(id).flush();},
  get editor(){return active?.editor||null;},
  setEditor(id,editor){releaseEditor();const current=session(id);editors.set(editor,id);active={id,editor};editor.setValue(current.values['任务详情']);editor.setReadOnly(!!current.draft);},
  bindWorklog(id,area){captureWorklog();worklogInput=null;area.value=worklogValue(id);worklogInput={id,area};},
  unbindWorklog(){captureWorklog();worklogInput=null;},
  sync(){for(const [id,current]of sessions)current.sync(L.find(id));},
  close(confirmClose=async()=>false){if(disposed)return Promise.resolve(true);if(!closing)closing=finishClose(confirmClose).finally(()=>{closing=null;});return closing;}
 };
};
function weekday(ds){const d=new Date(ds+'T12:00:00');return '星期'+'日一二三四五六'[d.getDay()];}
function displayRows(state){
 return L.tasks().filter(t=>!state.hiddenTasks.has(C.id(t))).map(t=>{const proposal=state.schedulePreviews.get(C.id(t));return proposal?{...t,...proposal.values}:t;});
}
function daySummary(ds,rows){const a=new Date(ds+'T00:00:00').getTime(),b=new Date(C.plusDays(ds,1)+'T00:00:00').getTime(),sum=C.summary(rows,L.store.data.logs,Date.now(),[a,b]);return {sum,planned:rows.filter(t=>C.onDay(t,ds)).length};}
function laneStyle(b,hasParallel){
 if(b.childLaneCount>1){const width=98.8/b.childLaneCount;return {left:.6+b.childLane*width,width:width-.6};}
 if(b.track==='parallel'){const width=28/Math.max(1,b.laneCount);return {left:72+b.lane*width+.5,width:Math.max(8,width-1)};}
 return {left:.6,width:hasParallel?70:98.8};
}
function cardHTML(b,state,hasParallel,rows){
 const t=b.task,status=t['任务状态']||C.STATUS[0],pos=laneStyle(b,hasParallel),top=b.start/60*HOUR,height=Math.max(32,(b.end-b.start)/60*HOUR),chosen=state.selected===b.id,kids=rows.filter(child=>child['父任务ID']===b.id),inherited=!!t._dayInherited;
 const label=(t['任务标题']||'未命名任务')+' · '+fmt(b.start)+'–'+fmt(b.end)+(inherited?' · 跟随父任务，拖动可单独安排':b.track==='parallel'?' · 并行':'');
 return '<div class="day-task-card '+L.statusClass(status)+(b.isSub?' is-sub':'')+(inherited?' is-inherited':'')+(b.track==='parallel'?' is-parallel':'')+(height<42?' is-compact':'')+(chosen?' selected':'')+'" role="button" tabindex="0" aria-pressed="'+chosen+'" aria-label="'+E(label)+'" title="'+E(label)+'" data-lane="'+b.track+'" data-task-id="'+E(b.id)+'" data-inherited="'+inherited+'" data-start="'+b.start+'" data-end="'+b.end+'" data-full-start="'+b.fullStart+'" data-full-end="'+b.fullEnd+'" style="top:'+top.toFixed(1)+'px;height:'+height.toFixed(1)+'px;left:'+pos.left.toFixed(2)+'%;width:'+pos.width.toFixed(2)+'%"><span class="day-resize start" data-resize="start" aria-hidden="true"></span><div class="day-card-title">'+(b.isSub?'<span class="day-sub-glyph">↳</span>':'')+E(t['任务标题'])+'</div><div class="day-card-time">'+fmt(b.start)+'–'+fmt(b.end)+(inherited?' · 跟随父任务':b.track==='parallel'?' · 并行':'')+'</div>'+(kids.length?'<span class="day-child-count">'+kids.filter(k=>k['任务状态']==='完成').length+'/'+kids.length+' 子任务</span>':'')+'<span class="day-move-handle" data-day-move aria-hidden="true" title="拖动排期，移回待办或拖到顶部删除">⋮</span><span class="day-resize end" data-resize="end" aria-hidden="true"></span></div>';
}
function timelineHTML(ds,role,parentId,state,rows){
 let source=rows;
 if(role==='sub'){
  const parent=rows.find(t=>C.id(t)===parentId),range=parent&&C.timelineRange(parent,ds);
  if(range&&(range.kind==='timed'||range.kind==='span'))source=rows.map(t=>t['父任务ID']===parentId&&!t['计划开始时间']&&!t['计划截止时间']?{...t,'计划开始时间':parent['计划开始时间'],'计划截止时间':parent['计划截止时间'],_dayInherited:true}:t);
 }
 const bars=C.timelineLayout(source,ds,{role,parentId});
 // A cross-midnight record has a real visible segment on each day. The older
 // generic layout puts spans in parking; Day shows those segments directly.
 for(const task of source){
  const isSub=!!(task['任务类型']==='子任务'||task['父任务ID']);if(role==='main'&&isSub||role==='sub'&&task['父任务ID']!==parentId)continue;
  const range=C.timelineRange(task,ds);if(range?.kind==='span'&&range.end>range.start&&C.planMinute(task['计划开始时间'])!==null&&C.planMinute(task['计划截止时间'])!==null)bars.push({id:C.id(task),task,start:range.start,end:range.end,isSub,track:'main',lane:0,laneCount:1});
 }
 bars.sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
 for(const bar of bars){const start=bar.task['计划开始时间'],end=bar.task['计划截止时间'];bar.fullStart=start?(Date.parse(C.day(start))-Date.parse(ds))/86400000*1440+(C.planMinute(start)??0):bar.start;bar.fullEnd=end?(Date.parse(C.day(end))-Date.parse(ds))/86400000*1440+(C.planMinute(end)??1440):bar.end;}
 let childLanes=1;
 if(role==='sub'){
  let cluster=[],clusterEnd=-1;
  const finish=()=>{const ends=[];for(const bar of cluster){let lane=ends.findIndex(end=>end<=bar.start);if(lane<0)lane=ends.length;ends[lane]=bar.end;bar.childLane=lane;}for(const bar of cluster)bar.childLaneCount=ends.length;childLanes=Math.max(childLanes,ends.length);cluster=[];};
  for(const bar of bars){if(cluster.length&&bar.start>=clusterEnd){finish();clusterEnd=-1;}cluster.push(bar);clusterEnd=Math.max(clusterEnd,bar.end);}if(cluster.length)finish();
 }
 const hasParallel=role!=='sub'&&bars.some(b=>b.track==='parallel'),hours=Array.from({length:24},(_,h)=>'<div class="day-hour-label" style="top:'+(h*HOUR)+'px">'+String(h).padStart(2,'0')+'</div>').join(''),lines=Array.from({length:144},(_,q)=>'<i class="day-grid-line '+(q%6===0?'hour':'')+'" style="top:'+(q*HOUR/6)+'px"></i>').join(''),now=new Date(),nowMin=now.getHours()*60+now.getMinutes(),nowLine=ds===C.localDay()?'<div class="day-now-line" style="top:'+(nowMin/60*HOUR).toFixed(1)+'px"><span>'+fmt(nowMin)+'</span></div>':'',conflict=state.conflict,ghost=conflict&&conflict.date===ds&&conflict.scope.role===role&&(role==='main'||conflict.scope.parentId===parentId)?'<div class="day-conflict-ghost" style="top:'+(conflict.start/60*HOUR).toFixed(1)+'px;height:'+Math.max(32,(conflict.end-conflict.start)/60*HOUR).toFixed(1)+'px"><strong>时间冲突</strong><span>'+fmt(conflict.start)+'–'+fmt(conflict.end)+'</span></div>':'';
 return '<div class="day-timeline-scroll" data-scroll-role="'+role+'"><div class="day-timeline-ruler" style="height:'+DAY+'px">'+hours+'</div><div class="day-timeline-track" data-timeline-role="'+role+'" data-parent-id="'+E(parentId||'')+'" style="height:'+DAY+'px;--child-lanes:'+childLanes+'">'+lines+nowLine+'<div class="day-card-layer">'+bars.map(b=>cardHTML(b,state,hasParallel,rows)).join('')+ghost+'</div></div></div>';
}
function parked(ds,rows){return rows.filter(t=>!C.terminal(t['任务状态'])&&(C.onDay(t,ds)||(!t['计划开始时间']&&!t['计划截止时间']))).filter(t=>{const range=C.timelineRange(t,ds);return !range||(range.kind!=='timed'&&!(range.kind==='span'&&C.planMinute(t['计划开始时间'])!==null&&C.planMinute(t['计划截止时间'])!==null));});}
function flowCardsHTML(ds,todo,center){
 // The two edge slots fade outside the five-card window. Repeated small lists
 // provide neighbors in both directions without a visible jump at the cycle.
 return (todo.length>1?[-3,-2,-1,0,1,2,3]:[0]).map(offset=>{const slot=center+offset,t=todo[cyclicIndex(slot,todo.length)],id=C.id(t),parent=t['父任务ID']&&L.find(t['父任务ID']),front=offset===0;return '<article class="day-flow-card '+(front?'is-front ':'')+L.statusClass(t['任务状态'])+'" data-day-flow-card data-day-park-id="'+E(id)+'" data-flow-slot="'+slot+'" data-flow-offset="'+offset+'" data-estimate="'+C.taskEstimateMinutes(t)+'" role="button" tabindex="'+(front?'0':'-1')+'" aria-hidden="'+!front+'" aria-label="'+E(t['任务标题'])+'，'+C.taskEstimateMinutes(t)+' 分钟，向下拖动安排" style="--flow-offset:'+offset+';--flow-opacity:'+(Math.abs(offset)<3?1:0)+';z-index:'+(20-Math.abs(offset)*4)+'"><div class="day-flow-eyebrow"><span><i class="status-dot '+L.statusClass(t['任务状态'])+'"></i>'+(parent?'子任务 · '+E(parent['任务标题']):'待办')+'</span><small>'+C.taskEstimateMinutes(t)+' 分钟</small></div><strong>'+E(t['任务标题']||'未命名记录')+'</strong><div class="day-flow-footer"><span>向下拖动安排</span><button type="button" tabindex="'+(front?'0':'-1')+'" data-day-action="schedule" data-id="'+E(id)+'" aria-label="安排 '+E(t['任务标题'])+' 到 '+ds+'">安排 '+icon('arrowDown',12)+'</button></div></article>';}).join('');
}
function coverflowHTML(ds,state,rows){
 const todo=parked(ds,rows),count=todo.length;state.flowIndex=count?cyclicIndex(state.flowIndex,count):0;
 return '<section class="day-coverflow '+(count?'':'is-empty')+'" data-day-coverflow aria-label="待办 Coverflow，左右滑动循环切换"><div class="day-flow-heading"><strong>待办</strong><span data-flow-counter aria-live="polite">'+(count?(state.flowIndex+1)+' / '+count:'暂无待办')+'</span><small>拖到这里，恢复待办</small></div><div class="day-flow-stage" data-day-flow-stage><button type="button" class="day-flow-arrow prev" data-day-action="flow-prev" aria-label="上一个待办" '+(count<2?'disabled':'')+'>'+icon('chevronLeft',20)+'</button><div class="day-flow-track" data-flow-center="'+state.flowIndex+'">'+(count?flowCardsHTML(ds,todo,state.flowIndex):'<div class="day-flow-empty">'+icon('note',22)+'<span>把任务拖回来，留待稍后安排</span></div>')+'</div><button type="button" class="day-flow-arrow next" data-day-action="flow-next" aria-label="下一个待办" '+(count<2?'disabled':'')+'>'+icon('chevronRight',20)+'</button></div></section>';
}
function tagsHTML(id){const links=L.store.data.links.filter(r=>r['任务ID']===id);return '<div class="day-tag-editor"><div class="day-tag-list">'+links.map(r=>'<span class="day-tag-chip">'+E(r['标签名称'])+'<button type="button" data-day-action="remove-tag" data-link-id="'+E(C.id(r))+'" aria-label="移除 '+E(r['标签名称'])+'">×</button></span>').join('')+'</div><div class="day-tag-add"><input data-day-tag-input placeholder="＋ 标签" aria-label="任务标签" maxlength="40"><button type="button" data-day-action="add-tag" aria-label="添加标签">'+icon('plus',13)+'</button></div></div>';}
const QUADRANTS=[{value:'紧急',icon:'flame',label:'重要且紧急',hint:'立即做',x:75,y:25},{value:'高',icon:'target',label:'重要不紧急',hint:'有计划地做',x:25,y:25},{value:'中',icon:'bolt',label:'紧急不重要',hint:'尽快处理',x:75,y:75},{value:'低',icon:'leaf',label:'不紧急不重要',hint:'择时做',x:25,y:75}];
function detailHTML(state){
 const stored=state.selected&&!state.hiddenTasks.has(state.selected)&&L.find(state.selected),t=stored?{...stored,...state.schedulePreviews.get(state.selected)?.values}:null;if(!t||t['回收站'])return '<aside class="day-detail-panel empty"><div class="day-detail-empty"><span>'+icon('arrowLeft',18)+'</span><strong>选择一个任务</strong><p>点选时间轴或上方待办卡片，开始编辑。</p></div></aside>';
 const id=C.id(t),session=state.drafts.session(id),tab=state.tab,kids=L.sort(L.tasks().filter(x=>x['父任务ID']===id)),notes=L.notes(id),logs=L.store.data.logs.filter(x=>x['任务ID']===id).sort((a,b)=>String(b['开始时间']).localeCompare(String(a['开始时间']))),parent=t['父任务ID']&&L.find(t['父任务ID']),statusIndex=Math.max(0,C.STATUS.indexOf(t['任务状态'])),quadrant=QUADRANTS.find(q=>q.value===t['优先级'])||QUADRANTS[3];let pane='';
 if(tab==='content')pane='<div class="day-detail-content"><div class="day-task-controls"><div class="day-control-label"><span>'+icon('layers',13)+'任务状态</span><span>'+E(L.planText(t))+'</span></div><div class="day-status-rail" data-day-status-rail><div class="day-status-labels">'+C.LABEL.map((name,i)=>'<span class="'+(statusIndex===i?'on':'')+'">'+icon(['inbox','play','pause','check','stop'][i],12)+E(name)+'</span>').join('')+'</div><input type="range" min="0" max="4" step="1" value="'+statusIndex+'" data-day-status-range aria-label="任务状态" aria-valuetext="'+E(C.LABEL[statusIndex])+'"></div><div class="day-content-properties"><div class="day-quadrant-group"><div class="day-control-label"><span>'+icon('quadrant',13)+'紧急重要四象限</span><small>拖动圆点</small></div><div class="day-quadrant" data-day-quadrant role="group" aria-label="紧急重要四象限" style="--quadrant-x:'+quadrant.x+'%;--quadrant-y:'+quadrant.y+'%">'+[QUADRANTS[1],QUADRANTS[0],QUADRANTS[3],QUADRANTS[2]].map(q=>'<button type="button" class="'+(quadrant.value===q.value?'on':'')+'" data-day-action="quadrant" data-value="'+q.value+'" aria-pressed="'+(quadrant.value===q.value)+'">'+icon(q.icon,12)+q.label+'</button>').join('')+'<span class="day-quadrant-knob" aria-hidden="true"></span></div></div><div class="day-tags-group"><div class="day-control-label"><span>'+icon('tag',13)+'标签</span>'+(parent?'<button type="button" data-day-action="select" data-id="'+E(C.id(parent))+'" title="返回父任务">↳ '+E(parent['任务标题'])+'</button>':'')+'</div>'+tagsHTML(id)+'</div></div><div class="day-child-list"><div class="day-detail-section-title"><button type="button" data-day-action="expand-children" data-id="'+E(id)+'">子任务 '+kids.filter(k=>k['任务状态']==='完成').length+'/'+kids.length+' '+icon(state.expandedParent===id?'chevronDown':'chevronRight',12)+'</button><button type="button" data-day-action="new-child" data-id="'+E(id)+'">'+icon('plus',13)+'子任务</button></div>'+(kids.length?'<div class="day-child-chips">'+kids.map(k=>'<button type="button" data-day-action="select" data-id="'+E(C.id(k))+'"><i class="status-dot '+L.statusClass(k['任务状态'])+'"></i><span>'+E(k['任务标题'])+'</span></button>').join('')+'</div>':'')+'</div></div><div data-day-draft-banner>'+L.draftHTML(session)+'</div><div class="save-state" data-day-save-state></div><div class="day-live-editor-host live-md-editor" data-day-editor-host data-task-id="'+E(id)+'"></div></div>';
 if(tab==='logs')pane='<div class="day-logs"><form class="day-worklog-compose" data-day-worklog><textarea rows="2" placeholder="记下进展、成果，或下一步…" aria-label="任务日志"></textarea><button type="submit">记一笔</button></form><div class="day-detail-section-title">执行记录 <span>'+notes.length+'</span></div>'+(notes.length?notes.map(n=>'<article><time>'+E(L.dateText(n['创建时间'],true))+'</time><p>'+E(n['便签内容'])+'</p></article>').join(''):'<p class="hint">记下做了什么，写周报时就有据可查。</p>')+'<div class="day-detail-section-title logs-title">状态时间 <span>'+logs.length+'</span></div>'+logs.map(l=>'<article class="state-log"><time>'+E(L.dateText(l['开始时间'],true))+'</time><p>'+E(L.statusLabel(l['状态']))+(l['结束时间']?' · '+E(L.dateText(l['结束时间'],true)):' · 当前')+'</p></article>').join('')+'</div>';
 return '<aside class="day-detail-panel" data-day-swipe="detail"><div class="day-detail-identity"><h3 class="day-task-title" data-day-task-title>'+E(session.values['任务标题']||'未命名任务')+'</h3><button type="button" class="mini-action day-delete-task" data-day-action="delete" aria-label="删除任务（可恢复）">'+icon('trash',15)+'</button></div><div class="day-detail-tabs" role="tablist" aria-label="任务详情"><button class="'+(tab==='content'?'on':'')+'" data-day-action="tab" data-tab="content" role="tab" aria-selected="'+(tab==='content')+'">'+icon('note',14)+'任务内容</button><button class="'+(tab==='logs'?'on':'')+'" data-day-action="tab" data-tab="logs" role="tab" aria-selected="'+(tab==='logs')+'">'+icon('log',14)+'任务日志</button></div><div class="day-detail-pane" data-day-pane="'+tab+'">'+pane+'</div></aside>';
}
function conflictHTML(state){return state.conflict?'<div class="day-conflict-resolver" data-timeline-conflict>'+L.scheduleConflictHTML(state.conflict)+'</div>':'';}
function pageHTML(ds,state){
 const date=new Date(ds+'T12:00:00'),rows=displayRows(state),summary=daySummary(ds,rows),parentId=state.expandedParent||'',parent=rows.find(t=>C.id(t)===parentId),hasSub=!!parent,main=timelineHTML(ds,'main','',state,rows),sub=hasSub?timelineHTML(ds,'sub',parentId,state,rows):'';
 return '<div class="day-timeline-page"><div class="day-trash-target" data-day-trash aria-hidden="true">'+icon('trash',22)+'<span>松开移入回收站</span><small>可撤销</small></div>'+coverflowHTML(ds,state,rows)+'<div class="day-workspace-surface"><div class="day-timeline-summary"><div class="day-date-lockup"><strong>'+(date.getMonth()+1)+'月'+date.getDate()+'日</strong><span>'+weekday(ds)+'<small>'+date.getFullYear()+'年</small></span></div><div class="day-summary-metrics"><span><b>'+summary.planned+'</b> 项安排</span><span>执行 <b>'+C.duration(summary.sum.unique)+'</b></span></div></div><div class="day-timeline-columns '+(hasSub?'has-sub':'')+'"><section class="day-axis-group">'+conflictHTML(state)+'<div class="day-axis-columns '+(hasSub?'has-sub':'')+'"><section class="day-timeline-pane day-main-pane"><header><span>当日时间轴</span><small class="day-touch-help">拖动卡片 · 双击展开子任务</small></header>'+main+'</section>'+(hasSub?'<section class="day-timeline-pane day-sub-pane"><header><button type="button" data-day-action="collapse-children" title="收起子任务">'+icon('chevronLeft',13)+'</button><span>'+E(parent['任务标题'])+'</span><button type="button" data-day-action="new-child" data-id="'+E(parentId)+'" aria-label="添加子任务">'+icon('plus',14)+'</button></header>'+sub+'</section>':'')+'</div></section>'+detailHTML(state)+'</div></div></div>';
}
function scrollDefault(root,ds){const now=new Date(),today=ds===C.localDay(),cards=[...root.querySelectorAll('.day-task-card')],first=cards.map(x=>Number(x.dataset.start)).filter(Number.isFinite).sort((a,b)=>a-b)[0],min=today?Math.max(0,now.getHours()*60+now.getMinutes()-90):(Number.isFinite(first)?Math.max(0,first-60):480);root.scrollTop=min/60*HOUR;}

L.openDayTimeline=function(ds=L.UI.date,focusId=''){
 if(!C.validDate(ds))return;
 const state={selected:focusId||'',revealSelected:!!focusId,tab:'content',expandedParent:L.find(focusId)?.['父任务ID']||'',flowIndex:0,schedulePreviews:new Map(),hiddenTasks:new Set(),scroll:{},initial:false,conflict:null,scheduleEpoch:0,chooseConflict:null,closed:false,closing:false,painting:false},attachments=window.OneDayLiteAttachments?.create(L.store);
 let paintSession=()=>{};state.drafts=L.createDayDrafts((id,current)=>paintSession(id,current));
 const d=L.dialog({title:ds+' · '+weekday(ds),wide:true,body:'<div id="dayTimelineRoot"></div>',onClose:()=>state.close?.()??true,onMount:api=>{
  api.root.classList.add('day-timeline-dialog');api.element.classList.add('day-timeline-backdrop');const root=api.q('#dayTimelineRoot'),gestures=window.OneDayLiteGestures.bind(api.element);
  let selectTimer=0,refreshTimer=0,paintFrame=0,scrollFrame=0,repaintPending=false,lastTouchTap={id:'',time:0},lastTouchAt=0,ignoreQuadrantClickUntil=0,flowPosition=state.flowIndex,flowFrame=0,flowTarget=null,vibrate=null,detailSwipe=null;
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  try{const navigator=window.navigator,method=navigator?.vibrate;if(typeof method==='function')vibrate=method.bind(navigator);}catch(_){/* Unsupported device capabilities stay silent. */}
  api.createRecord=()=>{if(state.closed||state.closing)return null;gestures.cancel('create');return L.openCreationSheet();};
  const createButton=document.createElement('button');createButton.className='icon-button day-create-record';createButton.setAttribute('type','button');createButton.setAttribute('data-day-action','create');createButton.setAttribute('aria-label','新建记录');createButton.setAttribute('title','新建记录（/ 或 +）');createButton.innerHTML=icon('plus',20);api.q('.dialog-header')?.append(createButton);
  paintSession=(id,current)=>{if(state.closed||state.painting||id!==state.selected)return;const title=root.querySelector('[data-day-task-title]'),banner=root.querySelector('[data-day-draft-banner]'),status=root.querySelector('[data-day-save-state]');if(title)title.textContent=current.values['任务标题']||'未命名任务';if(banner)banner.innerHTML=L.draftHTML(state.drafts.session(id));if(status){status.className='save-state'+(current.error?' error':'');status.textContent=current.error?(L.draftStorageAvailable?'未保存 · 草稿留在本机':'未保存 · 请保留当前页面'):current.draft?'有待恢复草稿':current.saving?'正在保存…':current.dirty?'待保存…':window.__ONEDAY_SITES__?'云端已保存':window.__ONEDAY_LOCAL__?'已保存到本机':'已保存到资料库';status.title=current.error||'';}};
  state.close=()=>{
   if(state.closed)return Promise.resolve(true);if(state.closePromise)return state.closePromise;state.closing=true;detailSwipe?.destroy();detailSwipe=null;gestures.cancel('close');stopFlow();clearParkDrag();state.scheduleEpoch++;state.chooseConflict?.('cancel');state.chooseConflict=null;state.conflict=null;api.root.inert=true;
   state.closePromise=(async()=>{const ok=await state.drafts.close(error=>L.confirm('内容尚未保存',(error.message||String(error))+'。要保留本机草稿并关闭吗？清理浏览器数据会丢失未提交草稿。','保留草稿并关闭'));if(!ok)return false;state.closed=true;gestures.destroy();state.unsub?.();clearTimeout(selectTimer);clearTimeout(refreshTimer);cancelAnimationFrame(paintFrame);cancelAnimationFrame(scrollFrame);return true;})().finally(()=>{state.closePromise=null;if(!state.closed){state.closing=false;api.root.inert=false;if(state.selected&&L.find(state.selected))state.drafts.session(state.selected).sync(L.find(state.selected));paint();}});return state.closePromise;
  };
  function remember(){api.qa('.day-timeline-scroll').forEach(n=>state.scroll[n.dataset.scrollRole]=n.scrollTop);state.workspaceScroll=root.querySelector('.day-timeline-columns')?.scrollTop||0;}
  function selectedTask(){return state.selected&&L.find(state.selected);}
  function saveBody(id,md,source){state.drafts.changeBody(id,md,source);}
  function switchDetailTab(index,focus=false){
   state.focusDetailTab=focus;
   if(detailSwipe)detailSwipe.go(index);else{state.tab=index?'logs':'content';paint();}
  }
  function mountDetailSwipe(){
   const pane=root.querySelector('[data-day-pane]'),strip=root.querySelector('.day-detail-tabs');
   if(!pane||!L.createSwipeTabs)return;
   detailSwipe=L.createSwipeTabs(pane,{targets:strip?[strip]:[],getIndex:()=>state.tab==='logs'?1:0,getCount:()=>2,
    preview:index=>{const snapshot=document.createElement('div');snapshot.innerHTML=detailHTML({...state,tab:index?'logs':'content'});const preview=snapshot.querySelector('[data-day-pane]'),editor=preview.querySelector('[data-day-editor-host]');if(editor){editor.classList.add('md-preview');editor.innerHTML=C.markdown(state.drafts.session(state.selected).values['任务详情']);}return preview.innerHTML;},
    commit:index=>{state.tab=index?'logs':'content';paint();},onEnd:committed=>{if(!committed)finishGesture();},
    canStart:event=>!event.target.closest('.live-md-editor,.table-scroll,pre,code,[data-day-quadrant],[data-day-status-rail],.day-child-chips')&&!window.getSelection?.()?.toString()
   });
   if(state.focusDetailTab){state.focusDetailTab=false;strip?.querySelector('[data-tab="'+state.tab+'"]')?.focus({preventScroll:true});}
  }
  function mountDetail(){const id=state.selected,t=id&&L.find(id);if(!t)return;const session=state.drafts.session(id),host=root.querySelector('[data-day-editor-host]');if(host&&window.OneDayLiteEditor){let editor;editor=window.OneDayLiteEditor.mount(host,{value:session.values['任务详情'],attachments,owner:{type:'task',id},onError:e=>L.toast(e.message,null,true),onChange:md=>saveBody(id,md,editor)});state.drafts.setEditor(id,editor);}const area=root.querySelector('[data-day-worklog] textarea');if(area)state.drafts.bindWorklog(id,area);session.sync(t);}
  function paint(){if(state.closed||state.closing)return;if(gestures.active||detailSwipe?.active){repaintPending=true;return;}repaintPending=false;stopFlow();if(!paintFrame)remember();cancelAnimationFrame(paintFrame);state.painting=true;detailSwipe?.destroy();detailSwipe=null;try{state.drafts.releaseEditor();state.drafts.unbindWorklog();state.drafts.sync();root.innerHTML=pageHTML(ds,state);flowPosition=state.flowIndex;}catch(e){L.toast(e.message||String(e),null,true);return;}finally{state.painting=false;}paintFrame=requestAnimationFrame(()=>{paintFrame=0;if(state.closed||state.closing)return;mountDetail();mountDetailSwipe();api.qa('.day-timeline-scroll').forEach(n=>{const saved=state.scroll[n.dataset.scrollRole];if(Number.isFinite(saved))n.scrollTop=saved;else if(!state.initial)scrollDefault(n,ds);});const main=root.querySelector('.day-main-pane .day-timeline-scroll'),sub=root.querySelector('.day-sub-pane .day-timeline-scroll');if(main&&sub){const top=Number.isFinite(state.scroll.main)?state.scroll.main:main.scrollTop;main.scrollTop=top;sub.scrollTop=top;state.scroll.main=state.scroll.sub=top;}if(state.focusCardId){const id=state.focusCardId;state.focusCardId='';api.qa('.day-task-card').find(card=>card.dataset.taskId===id)?.focus?.({preventScroll:true});}const workspace=root.querySelector('.day-timeline-columns');if(workspace)workspace.scrollTop=state.workspaceScroll||0;if(state.revealSelected){state.revealSelected=false;L.revealDaySelection?.(root);}state.initial=true;});}
  async function changeSchedule(id,props,base){
   const proposal={values:Object.fromEntries(Object.entries(props).map(([key,value])=>[key,C.value(value)]))};
   proposal.values['任务状态']=L.scheduleStatus({...base,...proposal.values});
   state.scheduleEpoch++;state.chooseConflict?.('cancel');state.chooseConflict=null;state.conflict=null;state.schedulePreviews.set(id,proposal);paint();
   const active=()=>!state.closed&&!state.closing;
   try{
    const saved=await L.saveTaskSchedule(id,props,base,{isActive:active,present:plan=>new Promise(resolve=>{
     if(!active()){resolve('cancel');return;}if(state.schedulePreviews.get(id)===proposal)state.schedulePreviews.delete(id);
     state.conflict=plan;state.conflictProposal=proposal;state.chooseConflict=resolve;paint();
    })});
    if(saved&&active())L.toast(props['计划开始时间']?.date===null?'已移回待办':'计划时间已调整 · '+L.planText(L.find(id)||base));return !!saved;
   }finally{
    if(state.schedulePreviews.get(id)===proposal)state.schedulePreviews.delete(id);
    if(state.conflictProposal===proposal){state.chooseConflict?.('cancel');state.chooseConflict=null;state.conflict=null;state.conflictProposal=null;}paint();
   }
  }
  const considerPlan=(id,start,end,base)=>{
   if(start>=0&&end<1440)return changeSchedule(id,C.timelinePatch(ds,start,end),base);
   const stamp=minute=>C.plusDays(ds,Math.floor(minute/1440))+'T'+fmt(((minute%1440)+1440)%1440)+':00Z';
   return changeSchedule(id,{'计划开始时间':{date:stamp(start)},'计划截止时间':{date:stamp(end)}},base);
  };
  function resolveConflict(action){const choose=state.chooseConflict;if(!choose)return;state.chooseConflict=null;api.qa('[data-conflict-action]').forEach(button=>button.disabled=true);choose(action);}
  function select(id,keepFocus=false){state.selected=id;state.revealSelected=true;state.tab='content';state.focusCardId=keepFocus?id:'';const parent=L.find(id)?.['父任务ID'];if(parent)state.expandedParent=parent;paint();}
  function stopFlow(){cancelAnimationFrame(flowFrame);flowFrame=0;flowTarget=null;}
  function flowStep(){return parseFloat(window.getComputedStyle(root.querySelector('.day-flow-track')).getPropertyValue('--flow-step'))||185;}
  function drawFlow(position){
   const track=root.querySelector('.day-flow-track'),todo=parked(ds,displayRows(state)),count=todo.length;if(!track||!count)return;
   flowPosition=count>1?position:0;const center=Math.round(flowPosition),restoreFocus=track.contains(document.activeElement);
   if(Number(track.dataset.flowCenter)!==center){track.innerHTML=flowCardsHTML(ds,todo,center);track.dataset.flowCenter=String(center);}
   for(const card of track.querySelectorAll('[data-day-flow-card]')){
    const offset=Number(card.dataset.flowSlot)-flowPosition,front=Number(card.dataset.flowSlot)===center;
    card.style.setProperty('--flow-offset',offset);card.style.zIndex=String(20-Math.round(Math.abs(offset)*4));card.style.setProperty('--flow-opacity',Math.max(0,Math.min(1,3-Math.abs(offset))));card.style.pointerEvents=Math.abs(offset)<2.75?'':'none';card.dataset.flowOffset=String(offset);
    card.classList.toggle('is-front',front);card.setAttribute('tabindex',front?'0':'-1');card.setAttribute('aria-hidden',String(!front));card.querySelector('button')?.setAttribute('tabindex',front?'0':'-1');
   }
   state.flowIndex=cyclicIndex(center,count);root.querySelector('[data-flow-counter]').textContent=(state.flowIndex+1)+' / '+count;
   if(restoreFocus&&!track.contains(document.activeElement))track.querySelector('.is-front')?.focus({preventScroll:true});
  }
  function settleFlow(target){
   stopFlow();if(state.closed||state.closing)return;
   const from=flowPosition;flowTarget=target;
   const finish=()=>{drawFlow(target);drawFlow(state.flowIndex);flowFrame=0;flowTarget=null;};
   if(reducedMotion?.matches||Math.abs(target-from)<.001){finish();return;}
   let started;
   const step=now=>{if(state.closed||state.closing){stopFlow();return;}if(started===undefined)started=now;const progress=Math.min(1,(now-started)/220);drawFlow(from+(target-from)*(1-Math.pow(1-progress,3)));if(progress<1)flowFrame=requestAnimationFrame(step);else finish();};
   flowFrame=requestAnimationFrame(step);
  }
  function cycleFlow(delta){if(parked(ds,displayRows(state)).length<2)return;settleFlow((flowTarget??Math.round(flowPosition))+delta);}
  function toggleChildren(id){state.selected=id;state.tab='content';state.expandedParent=state.expandedParent===id?'':id;paint();}
  async function removeTask(id,immediate=false){
   const ids=[id,...C.descendants(id,L.tasks())],selected=state.selected;
   const flush=async()=>{for(const taskId of ids)await state.drafts.flushTask(taskId);};
   if(!immediate){await flush();if(await L.deleteTask(id)){if(ids.includes(state.selected))state.selected='';if(ids.includes(state.expandedParent))state.expandedParent='';paint();}return;}
   ids.forEach(taskId=>state.hiddenTasks.add(taskId));if(ids.includes(state.selected))state.selected='';paint();
   const restore=()=>{ids.forEach(taskId=>state.hiddenTasks.delete(taskId));if(!state.selected&&ids.includes(selected))state.selected=selected;paint();};
   try{const removed=await L.deleteTask(id,{confirm:false,beforeDelete:flush,onUndo:restore});if(!removed)restore();else{ids.forEach(taskId=>state.hiddenTasks.delete(taskId));paint();}}
   catch(error){restore();throw error;}
  }
  function moveToTodo(id,base){
   return changeSchedule(id,{'计划开始时间':{date:null},'计划截止时间':{date:null}},base);
  }
  let syncingScroll=false;
  api.element.addEventListener('scroll',e=>{const sc=e.target.closest?.('.day-timeline-scroll');if(!sc||syncingScroll)return;const role=sc.dataset.scrollRole;if(role!=='main'&&role!=='sub')return;const other=root.querySelector('.day-timeline-scroll[data-scroll-role="'+(role==='main'?'sub':'main')+'"]');if(!other||Math.abs(other.scrollTop-sc.scrollTop)<1)return;syncingScroll=true;other.scrollTop=sc.scrollTop;state.scroll.main=state.scroll.sub=sc.scrollTop;scrollFrame=requestAnimationFrame(()=>{syncingScroll=false;});},true);
  api.element.addEventListener('click',e=>{
   const local=e.target.closest('[data-local]');if(local&&state.selected){const session=state.drafts.session(state.selected);if(local.dataset.local==='restore')session.restore();if(local.dataset.local==='discard')session.discard();if(local.dataset.local==='export')session.export();return;}
   const conflict=e.target.closest('[data-conflict-action]');if(conflict){resolveConflict(conflict.dataset.conflictAction);return;}
   const button=e.target.closest('[data-day-action]');if(!button)return;const action=button.dataset.dayAction;
   if(action==='create')api.createRecord();
   if(action==='select')select(button.dataset.id);
   if(action==='schedule')L.openPlan(button.dataset.id,{date:ds});
   if(action==='delete'&&state.selected)L.run(()=>removeTask(state.selected),button);
   if(action==='tab')switchDetailTab(button.dataset.tab==='logs'?1:0);
   if(action==='flow-prev'||action==='flow-next')cycleFlow(action==='flow-prev'?-1:1);
   if(action==='expand-children')toggleChildren(button.dataset.id);
   if(action==='collapse-children'){state.expandedParent='';paint();}
   if(action==='new-child'){const id=button.dataset.id;state.expandedParent=id;paint();L.newTaskDialog({parent:id});}
   if(action==='quadrant'&&state.selected&&Date.now()>=ignoreQuadrantClickUntil){const task=selectedTask();if(task)L.run(async()=>{await L.store.patch('tasks',C.id(task),{'优先级':{select:button.dataset.value}},task,{optimistic:true});paint();});}
   if(action==='add-tag'&&state.selected){const input=root.querySelector('[data-day-tag-input]'),name=input?.value.trim(),id=state.selected;if(name){input.value='';L.run(async()=>{await L.store.addTag(id,name);paint();});}}
   if(action==='remove-tag'&&button.dataset.linkId)L.run(async()=>{await L.store.removeLink(button.dataset.linkId);paint();});
  });
  api.element.addEventListener('dblclick',e=>{if(Date.now()-lastTouchAt<500)return;const card=e.target.closest('.day-task-card,[data-day-flow-card]');if(!card)return;e.preventDefault();clearTimeout(selectTimer);toggleChildren(card.dataset.taskId||card.dataset.dayParkId);});
  api.element.addEventListener('input',e=>{
   const worklog=e.target.closest('[data-day-worklog] textarea');if(worklog&&state.selected)state.drafts.changeWorklog(state.selected,worklog.value);
   const slider=e.target.closest('[data-day-status-range]');if(slider){const index=Number(slider.value);slider.setAttribute('aria-valuetext',C.LABEL[index]);root.querySelectorAll('.day-status-labels span').forEach((label,i)=>label.classList.toggle('on',i===index));}
  });
  api.element.addEventListener('keydown',e=>{
   if(e.isComposing)return;
   const card=e.target.closest('.day-task-card,[data-day-flow-card]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();select(card.dataset.taskId||card.dataset.dayParkId,true);return;}
   if(card?.matches('[data-day-flow-card]')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();cycleFlow(e.key==='ArrowLeft'?-1:1);return;}
   const tab=e.target.closest('[role="tab"]');if(tab&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();switchDetailTab(state.tab==='content'?1:0,true);return;}
   const tag=e.target.closest('[data-day-tag-input]');if(tag&&e.key==='Enter'){e.preventDefault();root.querySelector('[data-day-action="add-tag"]')?.click();}
  });
  api.element.addEventListener('submit',e=>{const form=e.target.closest('[data-day-worklog]');if(!form||!state.selected)return;e.preventDefault();const id=state.selected,area=form.querySelector('textarea');state.drafts.changeWorklog(id,area.value);L.run(async()=>{if(await state.drafts.submitWorklog(id))paint();},form.querySelector('button[type="submit"]'));});
  api.element.addEventListener('change',e=>{
   const slider=e.target.closest('[data-day-status-range]');if(!slider||!state.selected)return;const task=selectedTask(),next=C.STATUS[Number(slider.value)];if(!task||next===task['任务状态'])return;
   L.run(async()=>{await L.changeStatus(C.id(task),next);paint();});
  });
  function finishGesture(){if(repaintPending&&!state.closed&&!state.closing)paint();}
  function tapTask(id,touch){
   const now=Date.now(),twice=lastTouchTap.id===id&&now-lastTouchTap.time<400;
   lastTouchAt=now;lastTouchTap={id:twice?'':id,time:now};clearTimeout(selectTimer);
   if(twice)toggleChildren(id);else select(id);
  }
  let dragGhost=null,dropPreview=null,timeFeedback=null;
  function clearTimeFeedback(){timeFeedback?.remove();timeFeedback=null;}
  function showTimeFeedback(point,range,card,touch){
   if(!timeFeedback){timeFeedback=document.createElement('div');timeFeedback.className='day-time-feedback';timeFeedback.setAttribute('aria-hidden','true');timeFeedback.style.position='fixed';api.element.append(timeFeedback);}
   timeFeedback.textContent=rangeLabel(range.start,range.end);
   const viewport=window.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight;
   timeFeedback.style.maxWidth=Math.max(0,width-16)+'px';const box=timeFeedback.getBoundingClientRect(),anchor=Math.min(point.y,card?.getBoundingClientRect().top??point.y);
   timeFeedback.style.left=Math.max(left+8,Math.min(point.x-box.width/2,left+width-box.width-8))+'px';
   timeFeedback.style.top=Math.max(top+8,Math.min(anchor-box.height-(touch?16:10),top+height-box.height-8))+'px';
  }
  function tickTime(touch,before,after){
   if(!touch||!vibrate||!before||before.start===after.start&&before.end===after.end)return;
   try{if(vibrate(7)===false)vibrate=null;}catch(_){vibrate=null;}
  }
  function clearParkDrag(){
   dragGhost?.remove();dropPreview?.remove();dragGhost=null;dropPreview=null;clearTimeFeedback();api.element.classList.remove('day-is-dragging','day-over-trash');
   root.querySelector('[data-day-coverflow]')?.classList.remove('day-flow-drop-target');root.querySelector('[data-day-trash]')?.setAttribute('aria-hidden','true');
   root.querySelectorAll('[data-day-flow-card]').forEach(card=>card.classList.remove('dragging'));
  }
  function dropTarget(point){
   const trash=root.querySelector('[data-day-trash]'),trashRect=trash?.getBoundingClientRect();
   if(trashRect&&point.x>=trashRect.left&&point.x<=trashRect.right&&point.y>=0&&point.y<=Math.max(70,trashRect.bottom))return {kind:'trash'};
   const flow=root.querySelector('[data-day-coverflow]'),flowRect=flow?.getBoundingClientRect();
   if(flowRect&&point.x>=flowRect.left&&point.x<=flowRect.right&&point.y>=flowRect.top&&point.y<=flowRect.bottom)return {kind:'todo'};
   for(const track of root.querySelectorAll('.day-timeline-track')){
    const rect=track.getBoundingClientRect(),visible=track.closest('.day-timeline-scroll').getBoundingClientRect();
    if(rect.width&&point.x>=rect.left&&point.x<=rect.right&&point.y>=visible.top&&point.y<=visible.bottom)return {kind:'timeline',track,start:Math.min(1440-SNAP,C.snapMinute((point.y-rect.top)/HOUR*60))};
   }
   return {kind:'outside'};
  }
  function showDrag(point,task,target,withGhost=false){
   api.element.classList.add('day-is-dragging');api.element.classList.toggle('day-over-trash',target.kind==='trash');
   root.querySelector('[data-day-trash]')?.setAttribute('aria-hidden','false');root.querySelector('[data-day-coverflow]')?.classList.toggle('day-flow-drop-target',target.kind==='todo');
   if(withGhost){if(!dragGhost){dragGhost=document.createElement('div');dragGhost.className='day-drag-ghost';dragGhost.textContent=task['任务标题'];api.element.append(dragGhost);}dragGhost.style.left=(point.x+12)+'px';dragGhost.style.top=(point.y+12)+'px';}
   else{dragGhost?.remove();dragGhost=null;}
  }
  function dropCard(id,base,target,duration){
   if(target.kind==='trash'){L.run(()=>removeTask(id,true));return;}
   if(target.kind==='todo'){L.run(()=>moveToTodo(id,base));return;}
   if(target.kind!=='timeline')return;
   const start=target.start,end=start+duration,parent=target.track.dataset.timelineRole==='sub'?target.track.dataset.parentId:base['父任务ID']||'';
   if(parent&&(parent===id||C.descendants(id,L.tasks()).includes(parent))){L.toast('不能把任务放进它自己的子任务里',null,true);return;}
   const props={'计划开始时间':{date:ds+'T'+fmt(start)+':00Z'},'计划截止时间':{date:C.plusDays(ds,Math.floor(end/1440))+'T'+fmt(end%1440)+':00Z'}};
   if(parent!==(base['父任务ID']||''))Object.assign(props,{'父任务ID':{text:parent||null},'任务类型':{select:parent?'子任务':'主任务'}});
   state.selected=id;state.tab='content';if(parent)state.expandedParent=parent;L.run(()=>changeSchedule(id,props,base));
  }
  api.element.addEventListener('pointerdown',e=>{
   if(state.closed||state.closing||gestures.active||e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
   const touch=e.pointerType==='touch',flowCard=e.target.closest('[data-day-flow-card]'),quadrant=e.target.closest('[data-day-quadrant]');
   if(quadrant&&state.selected){
    const id=state.selected,base=JSON.parse(JSON.stringify(selectedTask())),rect=quadrant.getBoundingClientRect();let next=base['优先级']||'低';
    const preview=point=>{const right=point.x>=rect.left+rect.width/2,important=point.y<rect.top+rect.height/2;next=important?(right?'紧急':'高'):(right?'中':'低');const choice=QUADRANTS.find(q=>q.value===next);quadrant.style.setProperty('--quadrant-x',choice.x+'%');quadrant.style.setProperty('--quadrant-y',choice.y+'%');quadrant.querySelectorAll('button').forEach(button=>button.classList.toggle('on',button.dataset.value===next));};
    const commit=point=>{preview(point);ignoreQuadrantClickUntil=Date.now()+250;if(next!==base['优先级'])L.run(async()=>{await L.store.patch('tasks',id,{'优先级':{select:next}},base,{optimistic:true});paint();});};
    gestures.start(e,{captureTarget:api.root,onMove:preview,onTap:commit,onCommit:commit,onCancel:paint,onEnd:finishGesture});return;
   }
   if(flowCard&&!e.target.closest('button,input,a')){
    const id=flowCard.dataset.dayParkId,task=L.find(id);if(!task)return;stopFlow();const base=JSON.parse(JSON.stringify(task)),duration=C.taskEstimateMinutes(task),flowBounds=flowCard.closest('[data-day-coverflow]').getBoundingClientRect(),origin=flowPosition,step=flowStep();let direction='',target={kind:'outside'},lastRange=null;
    gestures.start(e,{captureTarget:api.root,threshold:6,
     onTap:()=>tapTask(id,touch),
     onMove:point=>{
      target=dropTarget(point);
      if(target.kind==='timeline'||target.kind==='trash'||point.y<flowBounds.top||point.y>flowBounds.bottom){if(direction!=='drag')drawFlow(Math.round(origin));direction='drag';}
      else if(!direction)direction=Math.abs(point.dx)>Math.abs(point.dy)*1.15?'cycle':'drag';
      if(direction==='cycle'){drawFlow(origin-point.dx/step);return;}
      showDrag(point,task,target,true);root.querySelectorAll('[data-day-flow-card]').forEach(card=>card.classList.toggle('dragging',card.dataset.dayParkId===id));
      if(target.kind==='timeline'){
       if(!dropPreview){dropPreview=document.createElement('div');dropPreview.className='day-select-band day-drop-preview';}
       if(dropPreview.parentElement!==target.track)target.track.append(dropPreview);
       dropPreview.style.top=(target.start/60*HOUR)+'px';dropPreview.style.height=Math.max(20,Math.min(duration,1440-target.start)/60*HOUR)+'px';dropPreview.textContent=fmt(target.start)+'–'+fmt((target.start+duration)%1440)+(target.start+duration>=1440?' 次日':'');
       const range={start:target.start,end:target.start+duration};showTimeFeedback(point,range,null,touch);tickTime(touch,lastRange,range);lastRange=range;
      }else{dropPreview?.remove();dropPreview=null;clearTimeFeedback();}
     },
     onCommit:point=>{if(direction==='cycle')settleFlow(Math.round(flowPosition));else if(direction==='drag')dropCard(id,base,dropTarget(point),duration);},
     onCancel:()=>{if(direction==='cycle')settleFlow(Math.round(origin));},onEnd:()=>{clearParkDrag();finishGesture();}
    });return;
   }
   const flowStage=e.target.closest('[data-day-flow-stage]');
   if(flowStage&&!e.target.closest('button')){
    stopFlow();const origin=flowPosition,step=flowStep();gestures.start(e,{captureTarget:api.root,onMove:point=>drawFlow(origin-point.dx/step),onCommit:()=>settleFlow(Math.round(flowPosition)),onCancel:()=>settleFlow(Math.round(origin)),onEnd:finishGesture});return;
   }
   const card=e.target.closest('.day-task-card'),track=e.target.closest('.day-timeline-track');
   if(card){
    const id=card.dataset.taskId,task=L.find(id);if(!task)return;
    const base=JSON.parse(JSON.stringify(task)),origS=Number(card.dataset.start),origE=Number(card.dataset.end),fullS=Number(card.dataset.fullStart??origS),fullE=Number(card.dataset.fullEnd??origE),edge=e.target.closest('[data-resize]')?.dataset.resize||'';
    const label=card.querySelector('.day-card-time'),oldLabel=label?.textContent||'',oldTop=card.style.top,oldHeight=card.style.height,scroll=card.closest('.day-timeline-scroll'),initialScroll=scroll.scrollTop;
    let last={start:fullS,end:fullE},target={kind:'timeline'};
    const restore=()=>{card.style.top=oldTop;card.style.height=oldHeight;if(label)label.textContent=oldLabel;card.classList.remove('dragging');};
    gestures.start(e,{
     threshold:touch&&!edge?8:4,captureTarget:api.root,
     onTap:()=>{if(!edge)tapTask(id,touch);},
     onMove:point=>{
      target=edge?{kind:'timeline'}:dropTarget(point);if(!edge)showDrag(point,task,target,target.kind==='todo'||target.kind==='trash');
      const bounds=scroll.getBoundingClientRect();if(point.y>bounds.bottom-30&&point.y<bounds.bottom)scroll.scrollTop+=10;else if(point.y<bounds.top+30&&point.y>bounds.top)scroll.scrollTop=Math.max(0,scroll.scrollTop-10);
      const delta=(point.dy+scroll.scrollTop-initialScroll)/HOUR*60;
      const previous=last;
      if(edge){const resized=C.timelineResize(origS,origE,edge,(edge==='start'?origS:origE)+delta);last={start:fullS+resized.start-origS,end:fullE+resized.end-origE};}
      else{const moved=C.timelineMove(origS,origE,delta),shift=moved.start-origS;last={start:fullS+shift,end:fullE+shift};}
      const visibleStart=Math.max(0,last.start),visibleEnd=Math.min(1440,last.end);card.classList.add('dragging');card.style.top=(visibleStart/60*HOUR)+'px';card.style.height=Math.max(32,(visibleEnd-visibleStart)/60*HOUR)+'px';if(label)label.textContent=fmt(visibleStart)+'–'+fmt(visibleEnd);
      if(target.kind==='todo'||target.kind==='trash')clearTimeFeedback();else{showTimeFeedback(point,last,card,touch);tickTime(touch,previous,last);}
     },
     onCommit:point=>{
      const destination=edge?{kind:'timeline'}:dropTarget(point);
      if(destination.kind==='trash'){L.run(()=>removeTask(id,true));return;}
      if(destination.kind==='todo'){L.run(()=>moveToTodo(id,base));return;}
      if(last.start===fullS&&last.end===fullE&&card.dataset.inherited!=='true'){restore();return;}
      L.run(()=>considerPlan(id,last.start,last.end,base));
     },
     onCancel:restore,onEnd:()=>{card.classList.remove('dragging');clearParkDrag();finishGesture();}
    });return;
   }
   if(!track)return;
   const rect=track.getBoundingClientRect(),role=track.dataset.timelineRole,parent=track.dataset.parentId||'',start=Math.min(1440-SNAP,C.snapMinute((e.clientY-rect.top)/HOUR*60));let end=Math.min(1440,start+60),band=null;
   const clearBand=()=>{band?.remove();band=null;};
   const draw=()=>{if(!band){band=document.createElement('div');band.className='day-select-band';track.append(band);}band.style.top=(Math.min(start,end)/60*HOUR)+'px';band.style.height=Math.max(12,Math.abs(end-start)/60*HOUR)+'px';band.textContent=fmt(Math.min(start,end))+' – '+fmt(Math.max(start,end));};
   const create=point=>{clearBand();const a=point?.dragging?Math.min(start,end):start,b=Math.max(start,end),values={date:ds,parent:role==='sub'?parent:'',start:fmt(a)};if(point?.dragging&&b-a>=SNAP)values.end=fmt(b);L.newTaskDialog(values);};
   const accepted=gestures.start(e,{allowPan:touch,captureTarget:api.root,onTap:create,onMove:point=>{end=C.snapMinute((point.y-rect.top)/HOUR*60);draw();},onCommit:create,onCancel:clearBand,onEnd:()=>{clearBand();finishGesture();}});if(accepted&&!touch)draw();
  });
  state.unsub=L.store.subscribe(()=>{if(state.closed||state.closing)return;for(const [id,proposal]of state.schedulePreviews){const task=L.find(id);if(task&&Object.entries(proposal.values).every(([key,value])=>C.same(task[key],value)))state.schedulePreviews.delete(id);}clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{const active=document.activeElement;if(active&&active.closest?.('.day-detail-panel')&&active.matches('input,textarea,select,[contenteditable]'))return;paint();},40);});paint();
 }});return d;
};
})();
