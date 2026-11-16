/* Small shared UI foundation. Rendering, dialogs, and app bindings are separate modules. */
(function(){'use strict';
const C=window.OneDayLiteCore,scope=window.__ONEDAY_SCOPE__||(window.__ONEDAY_LOCAL__?'local':'workbuddy'),prefix='oneday.lite.v1.'+scope+'.';
let storageFailed=false,storageAvailable=true,activeDraftFlush=null;
const read=(k,f=null)=>{try{const r=localStorage.getItem(prefix+k);return r?JSON.parse(r):f;}catch(e){return f;}};
function save(k,v){try{localStorage.setItem(prefix+k,JSON.stringify(v));storageAvailable=true;return true;}catch(e){storageAvailable=false;if(activeDraftFlush)activeDraftFlush.failed=true;if(!storageFailed){storageFailed=true;setTimeout(()=>L.toast('浏览器不允许本地存储，草稿无法跨刷新保留。请及时保存或导出。',null,true),10);}return false;}}
const remove=k=>{try{localStorage.removeItem(prefix+k);}catch(e){}};
const paths={plus:'M12 5v14M5 12h14',search:'M21 21l-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',clock:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',settings:'M4 7h16M4 17h16M9 4v6M16 14v6',chevronDown:'m7 10 5 5 5-5',chevronRight:'m9 6 6 6-6 6',chevronLeft:'m15 6-6 6 6 6',calendar:'M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1',board:'M4 4h6v16H4zM14 4h6v10h-6z',note:'M6 3h9l5 5v13H4V3h2M14 3v6h6M8 13h8M8 17h5',check:'m5 12 4 4L19 6',play:'m8 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',x:'m6 6 12 12M18 6 6 18',more:'M5 12h.01M12 12h.01M19 12h.01',filter:'M4 6h16M7 12h10M10 18h4',arrowUp:'M12 19V5m-5 5 5-5 5 5',arrowRight:'M5 12h14m-5-5 5 5-5 5',pin:'m9 3 6 0-1 7 4 4H6l4-4-1-7M12 14v7',link:'M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2',archive:'M4 4h16v4H4zM6 8v12h12V8M10 12h4',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',undo:'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12',edit:'m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',tag:'M3 3h8l10 10-8 8L3 11ZM7 7h.01',sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8',refresh:'M20 8V3l-3 3M4 16v5l3-3M20 8a8 8 0 0 0-14-3M4 16a8 8 0 0 0 14 3',info:'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',image:'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M16 7h.01',spark:'m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z',folder:'M3 7V4h7l2 3h9v13H3Z',subtask:'M6 3v12h12M14 11l4 4-4 4',stop:'M6 6h12v12H6z',copy:'M8 8h13v13H8zM16 8V3H3v13h5'};
Object.assign(paths,{fullscreen:'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',fullscreenExit:'M3 8h5V3M16 3v5h5M21 16h-5v5M8 21v-5H3',today:'M12 3v3M12 18v3M3 12h3M18 12h3M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 10v2l1 1',quadrant:'M3 3h18v18H3zM12 3v18M3 12h18',flame:'M13 3c1 5-5 5-3 9-3-1-3-3-3-3-5 7-1 12 5 12 7 0 10-8 1-18Z',target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 12h.01',bolt:'m13 2-9 12h7l-1 8 10-13h-7Z',leaf:'M20 4C4 2 2 10 5 16s16 6 15-12ZM5 20l10-10',log:'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',layers:'m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5',quote:'M4 5h6v7H5c0 3 2 4 4 4v3c-4 0-6-3-6-7V5Zm11 0h6v7h-5c0 3 2 4 4 4v3c-4 0-6-3-6-7V5Z',timer:'M9 2h6M12 6v7l3 2M19 5l2 2M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0',inbox:'M5 4h14l3 10v6H2v-6ZM2 14h6l2 3h4l2-3h6',arrowLeft:'M19 12H5m5-5-5 5 5 5',arrowDown:'M12 5v14m-5-5 5 5 5-5'});
function icon(name,size=18){return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name]||paths.note)+'"/></svg>';}
const $=id=>document.getElementById(id),UI={tab:'tasks',view:read('view','calendar'),calendar:'month',date:C.localDay(),filter:'all',priority:'',tag:'',noteFilter:'all',unscheduled:true,captureKind:'task',parsed:read('parsed',true),boardColumn:0,detailId:null,theme:window.OneDayLiteThemes.normalize(read('theme','mist-blue'))};
if(!['calendar','board','stats'].includes(UI.view))UI.view='calendar';UI.calendar='month';
const L=window.OneDayLite={C,$,UI,read,save,remove,icon,scope,store:null,actions:{},timers:new Map(),modalStack:[],detail:null,renderTimer:null,capturingDrafts:false};
const draftSources=new Set();
Object.defineProperty(L,'draftStorageAvailable',{get:()=>storageAvailable});
L.registerDraftSource=function(source){draftSources.add(source);return ()=>draftSources.delete(source);};
// Lifecycle callers need a synchronous local snapshot; sources suppress cloud autosave while capturing.
L.flushDrafts=function(){
 const previous=activeDraftFlush,wasCapturing=L.capturingDrafts,current={failed:false};
 activeDraftFlush=current;L.capturingDrafts=true;
 try{for(const source of [...draftSources]){try{if(source.flushLocal()===false)current.failed=true;}catch(e){current.failed=true;}}}
 finally{if(previous&&current.failed)previous.failed=true;activeDraftFlush=previous;L.capturingDrafts=wasCapturing;}
 return !current.failed;
};
L.hasUnsavedChanges=function(){for(const source of draftSources){try{if(source.isDirty())return true;}catch(e){return true;}}return false;};
L.listDrafts=function(){const out={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix)){const short=k.slice(prefix.length);if(/^(draft\.|capture\.|newtask\.|newnote\.|newrecord\.|worklog\.|repair\.)/.test(short)){const value=read(short);if(value)out[short]=value;}}}return out;}catch(e){throw Error('浏览器不允许读取本机草稿，请直接复制尚未提交的内容。');}};
L.clearDrafts=function(){for(const k of Object.keys(L.listDrafts()))remove(k);};
L.setTheme=function(v){v=window.OneDayLiteThemes.normalize(v);UI.theme=v;save('theme',v);window.OneDayLiteThemes.apply(v);window.OneDayLiteThemes.scheduleReflection(document.querySelector('.calendar-main'));return v;};L.setTheme(UI.theme);
L.icons=function(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));};L.icons();
L.statusClass=s=>['idle','doing','paused','done','ended'][Math.max(0,C.STATUS.indexOf(s))];
L.statusLabel=s=>C.LABEL[Math.max(0,C.STATUS.indexOf(s))];
L.statusIcon=s=>['inbox','play','pause','check','stop'][Math.max(0,C.STATUS.indexOf(s))];
L.pill=s=>'<span class="pill '+L.statusClass(s)+'"><i class="status-dot '+L.statusClass(s)+'"></i>'+C.esc(L.statusLabel(s))+'</span>';
L.tags=id=>L.store.data.links.filter(r=>r['任务ID']===id).map(r=>r['标签名称']);
L.tasks=()=>L.store.data.tasks.filter(t=>!t['回收站']);
L.find=id=>L.store.get('tasks',id);
L.notes=id=>L.store.data.notes.filter(n=>n['关联任务ID']===id).sort((a,b)=>String(b['创建时间']).localeCompare(String(a['创建时间'])));
L.body=t=>t['任务详情']!==undefined&&t['任务详情']!==null?t['任务详情']:(t['任务描述']||'');
L.time=id=>{const t=L.find(id);return t?C.taskTime(t,L.store.data.logs):{doing:0,issues:[],segments:[]};};
L.dateText=(iso,withTime=false)=>{if(!iso)return '未安排';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return String(iso);return d.toLocaleString('zh-CN',withTime?{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}:{month:'numeric',day:'numeric'});};
L.planText=t=>{const a=t['计划开始时间'],b=t['计划截止时间'];if(!a&&!b)return '未安排';const x=String(a||b),today=C.localDay(),date=x.slice(0,10);let label=date===today?'今天':date===C.plusDays(today,1)?'明天':date===C.plusDays(today,-1)?'昨天':Number(x.slice(5,7))+'月'+Number(x.slice(8,10))+'日';const ta=String(a||'').slice(11,16),tb=String(b||'').slice(11,16);if(ta&&ta!=='00:00')label+=' '+ta;if(b&&b.slice(0,10)!==date)label+=' → '+Number(b.slice(5,7))+'/'+Number(b.slice(8,10));else if(tb&&ta&&ta!=='00:00'&&tb!=='23:59')label+='–'+tb;return label;};
L.sort=rows=>rows.slice().sort((a,b)=>{const done=Number(C.terminal(a['任务状态']))-Number(C.terminal(b['任务状态']));if(done)return done;const av=a['排序序号'],bv=b['排序序号'];if(av!=null&&bv!=null&&av!==bv)return av-bv;const p={'紧急':0,'高':1,'中':2,'低':3};return (p[a['优先级']]??4)-(p[b['优先级']]??4)||String(a['计划截止时间']||'9999').localeCompare(String(b['计划截止时间']||'9999'))||String(b['创建时间']||'').localeCompare(String(a['创建时间']||''));});
L.filtered=()=>L.sort(L.tasks().filter(t=>{const f=UI.filter,ds=C.localDay(),deadline=C.day(t['计划截止时间']);if(UI.priority&&t['优先级']!==UI.priority)return false;if(UI.tag&&!L.tags(C.id(t)).includes(UI.tag))return false;if(f==='active'&&C.terminal(t['任务状态']))return false;if(f==='today'&&!C.onDay(t,ds))return false;if(f==='week'&&!C.weekDays(ds).some(d=>C.onDay(t,d)))return false;if(f==='unscheduled'&&(t['计划开始时间']||t['计划截止时间']))return false;if(f==='overdue'&&(!deadline||deadline>=ds||C.terminal(t['任务状态'])))return false;return true;}));
L.empty=(title,description,act='capture-focus',label='记下一件事')=>'<div class="empty-state"><div class="empty-mark">'+icon('spark',22)+'</div><h3>'+C.esc(title)+'</h3><p>'+C.esc(description)+'</p>'+(act?'<button class="text-button" data-act="'+act+'">'+icon('plus',14)+C.esc(label)+'</button>':'')+'</div>';
let toastTimer;L.toast=function(message,action=null,error=false){clearTimeout(toastTimer);$('toastRoot').innerHTML='<div class="toast'+(error?' toast-error':'')+'"><span>'+C.esc(message)+'</span>'+(action?'<button id="toastAction">'+C.esc(action.label)+'</button>':'')+'</div>';if(action)$('toastAction').onclick=action.run;toastTimer=setTimeout(()=>$('toastRoot').innerHTML='',error||action?9000:4500);};
L.handleError=function(e){if(e.partial&&e.lostSegment){L.save('repair.'+e.taskId,e.lostSegment);L.toast(e.message,{label:'补记',run:()=>L.openLogForm(e.taskId,e.lostSegment)},true);}else if(e.partial&&e.createdTask){L.toast(e.message,{label:'查看任务',run:()=>L.openTask(e.createdTask)},true);}else L.toast(e.message||String(e),null,true);};
L.run=async(fn,button)=>{if(button){if(button.dataset.busy)return;button.dataset.busy='1';button.disabled=true;}try{return await fn();}catch(e){L.handleError(e);}finally{if(button){button.disabled=false;delete button.dataset.busy;}}};
L.download=function(name,data,type='text/plain;charset=utf-8'){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);};
L.debounce=function(key,fn,ms=600){clearTimeout(L.timers.get(key));L.timers.set(key,setTimeout(()=>{L.timers.delete(key);fn();},ms));};
L.autosize=function(el,max=160){if(!el)return;el.style.height='auto';el.style.height=Math.min(max,Math.max(26,el.scrollHeight))+'px';};
L.updateInert=function(){const active=L.modalStack.length>0; $('app').inert=active||!!L.detail;if(L.detail)L.detail.element.inert=active;L.modalStack.forEach((m,i)=>m.element.inert=i!==L.modalStack.length-1);};
let modalSeq=0;
L.dialog=function({title,body,footer='',wide=false,onClose,onMount}){
 const previous=document.activeElement,el=document.createElement('div'),titleId='dialogTitle'+(++modalSeq);el.className='dialog-backdrop';el.style.zIndex=100+L.modalStack.length*2;
 el.innerHTML='<section class="dialog'+(wide?' wide':'')+'" role="dialog" aria-modal="true" aria-labelledby="'+titleId+'"><header class="dialog-header"><h2 id="'+titleId+'">'+C.esc(title)+'</h2>'+(L.fullscreenButton?.()||'')+'<button class="icon-button modal-close" aria-label="关闭">'+icon('x')+'</button></header><div class="dialog-body">'+body+'<div class="dialog-error" role="alert" hidden></div></div>'+(footer?'<footer class="dialog-footer">'+footer+'</footer>':'')+'</section>';
 const api={element:el,root:el.querySelector('.dialog'),q:s=>el.querySelector(s),qa:s=>[...el.querySelectorAll(s)],error:e=>{let n=el.querySelector('.dialog-error');n.hidden=false;n.textContent=e.message||e;},close:async(force=false)=>{if(!force&&onClose){const ok=await onClose();if(ok===false)return;}el.remove();L.modalStack=L.modalStack.filter(m=>m!==api);L.updateInert();if(previous&&previous.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true});},on:(selector,event,fn)=>{el.querySelector(selector)?.addEventListener(event,fn);}};
 let backdropPress=true;el.addEventListener('pointerdown',e=>{backdropPress=e.target===el;});
 el.querySelector('.modal-close').onclick=()=>api.close();el.addEventListener('click',e=>{if(e.target===el&&backdropPress)api.close();backdropPress=true;});$('modalRoot').append(el);L.paintFullscreen?.(el);L.modalStack.push(api);L.updateInert();if(onMount)onMount(api);
 setTimeout(()=>{
  // Keep synchronous mount/user focus; covered and closed dialogs cannot claim it.
  if(!el.isConnected||L.modalStack.at(-1)!==api||el.closest('[inert]')||el.contains(document.activeElement))return;
  const target=el.querySelector('[autofocus]')||el.querySelector('input:not([type=hidden]),textarea,.modal-close');target?.focus({preventScroll:true});
 },50);return api;
};
L.confirm=function(title,message,label='确定',danger=false){return new Promise(resolve=>{let decided=false;const d=L.dialog({title,body:'<p class="hint">'+C.esc(message)+'</p>',footer:'<button class="button" id="confirmNo">取消</button><button class="button '+(danger?'danger':'primary')+'" id="confirmYes">'+C.esc(label)+'</button>',onClose:()=>{if(!decided)resolve(false);},onMount:d=>{d.on('#confirmNo','click',()=>d.close());d.on('#confirmYes','click',()=>{decided=true;resolve(true);d.close(true);});}});});};
L.paintSync=function(){
 if(!L.store)return;
 const s=L.store.state,sites=!!window.__ONEDAY_SITES__,errors=[window.__ONEDAY_LOCAL_ERROR__,s.readError,s.writeError];
 const authRequired=sites&&(window.__ONEDAY_AUTH_REQUIRED__||s.authRequired||[s.status,s.readStatus,s.writeStatus].some(status=>status===401)||errors.some(error=>/\b401\b|登录/.test(error?.message||error||'')));
 const err=errors.find(Boolean)||(authRequired?'请登录 ChatGPT 后继续同步。':'');
 const text=s.pending?'保存中':!s.connected?'未连接':!s.loaded?'读取中':sites?(s.lastWrite?'云端已保存':'已连接云端'):window.__ONEDAY_LOCAL__?'本机已保存':s.lastWrite?'已保存':'已读取';
 $('syncLabel').textContent=err?'需检查':text;$('syncButton').className='sync-button'+(err?' error':'')+(s.pending?' saving':'');$('syncButton').title=err||text+' · '+(s.lastRead?new Date(s.lastRead).toLocaleTimeString():'等待连接');
 const notice=$('connectionNotice');notice.hidden=!err;
 notice.innerHTML=err?'<span>'+C.esc(err)+(s.loaded?' · 保留上次成功读取的数据。':'')+'</span><button data-act="refresh">重读</button>'+(authRequired?'<a href="/signin-with-chatgpt?return_to=/" target="_top">登录 ChatGPT</a>':''):'';
 $('environmentLabel').textContent=sites?'私人空间 · 云端同步':window.__ONEDAY_LOCAL__?'本机体验 · 不跨设备同步':'私人空间 · '+(s.loaded?'最近读取 '+new Date(s.lastRead).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'等待 WorkBuddy 数据环境');
};
L.paintTimes=function(){document.querySelectorAll('[data-time]').forEach(el=>{const t=L.time(el.dataset.time);el.textContent=el.dataset.format==='clock'?C.clock(t.doing):C.duration(t.doing);});};
})();
