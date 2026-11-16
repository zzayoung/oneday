'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Store=require('../../src/lite/store.js');
const ROOT=path.resolve(__dirname,'../..'),DAY='2026-10-19';
const scripts=['src/core.js','src/lite/core.js','src/lite/themes.js','src/lite/ui.js','src/lite/views.js','src/lite/navigation.js','src/lite/dialogs.js','src/lite/editor.js','src/lite/gestures.js','src/lite/timeline.js'].map(file=>[file,fs.readFileSync(path.join(ROOT,file),'utf8')]);
const copy=value=>JSON.parse(JSON.stringify(value));
const decode=value=>String(value).replace(/&(?:amp|quot|#39|lt|gt);/g,entity=>({'&amp;':'&','&quot;':'"','&#39;':"'",'&lt;':'<','&gt;':'>'}[entity]));
const camel=value=>value.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());

// A deliberately small DOM boundary: production HTML creates the nodes, native
// EventTarget delivers events, and layout exposes the timeline's inline geometry.
// Selection, gesture decisions, drafts, and schedule routing run production code.
class Element extends EventTarget{
 constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.nodeType=1;this.parentElement=null;this.childNodes=[];this.attrs={};this.dataset={};this.style={};this.scrollTop=0;this.value='';this.captures=new Set();
  Object.defineProperty(this.style,'setProperty',{value:(name,value)=>{this.style[name]=String(value);}});
  Object.defineProperty(this.style,'cssText',{get:()=>Object.entries(this.style).map(([key,value])=>key+':'+value).join(';'),set:value=>{for(const key of Object.keys(this.style))delete this.style[key];for(const part of String(value).split(';')){const colon=part.indexOf(':');if(colon>0)this.style[camel(part.slice(0,colon).trim())]=part.slice(colon+1).trim();}}});
  this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle:(name,force)=>{const on=force??!this.classList.contains(name);this.classList[on?'add':'remove'](name);return on;}};
 }
 get firstChild(){return this.childNodes[0]||null;}
 get clientWidth(){return this.getBoundingClientRect().width;}
 get clientHeight(){return this.getBoundingClientRect().height;}
 get children(){return this.childNodes.filter(node=>node.nodeType===1);}
 get className(){return this.attrs.class||'';}set className(value){this.attrs.class=String(value);}
 get isConnected(){return !!this._connected||!!this.parentElement?.isConnected;}
 get textContent(){return this.childNodes.map(node=>node.textContent).join('');}set textContent(value){this.clear();this.childNodes=[{nodeType:3,textContent:String(value)}];}
 get innerHTML(){return this.html||'';}set innerHTML(value){this.html=String(value);this.clear();parse(this,this.html);}
 get tabIndex(){return Number(this.attrs.tabindex??-1);}
 clear(){for(const node of this.children)node.parentElement=null;this.childNodes=[];}
 append(...nodes){for(const node of nodes){node.remove?.();node.parentElement=this;this.childNodes.push(node);}}
 insertBefore(node,reference){node.remove?.();const i=this.childNodes.indexOf(reference);this.childNodes.splice(i<0?this.childNodes.length:i,0,node);node.parentElement=this;}
 remove(){if(this.parentElement){const parent=this.parentElement;parent.childNodes=parent.childNodes.filter(node=>node!==this);this.parentElement=null;}}
 setAttribute(name,value){this.attrs[name]=String(value);if(name.startsWith('data-'))this.dataset[camel(name.slice(5))]=String(value);if(name==='style')this.style.cssText=value;if(name==='value')this.value=String(value);}
 getAttribute(name){return name==='style'?this.style.cssText:this.attrs[name]??null;}
 removeAttribute(name){delete this.attrs[name];}
 matches(selector){return selector.split(',').some(part=>match(this,part.trim().split(/\s+/)));}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){const out=[];for(const child of this.children){if(child.matches(selector))out.push(child);out.push(...child.querySelectorAll(selector));}return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 contains(node){for(;node;node=node.parentElement)if(node===this)return true;return false;}
 focus(){this.ownerDocument.activeElement=this;}
 setPointerCapture(id){this.captures.add(id);}
 hasPointerCapture(id){return this.captures.has(id);}
 releasePointerCapture(id){this.captures.delete(id);emit(this.ownerDocument,'lostpointercapture',this,{pointerId:id});}
 getBoundingClientRect(){
  if(this.classList.contains('day-timeline-track'))return rect(60,250-(this.closest('.day-timeline-scroll')?.scrollTop||0),140,1152);
  if(this.classList.contains('day-timeline-scroll'))return rect(30,250,170,500);
  if(this.classList.contains('day-coverflow'))return rect(0,76,390,132);
  if(this.classList.contains('day-trash-target'))return rect(30,8,330,56);
  if(this.classList.contains('day-time-feedback'))return rect(parseFloat(this.style.left)||0,parseFloat(this.style.top)||0,160,32);
  if(this.classList.contains('day-quadrant'))return rect(220,400,160,70);
  const card=this.closest('.day-task-card');
  if(card){const track=card.closest('.day-timeline-track').getBoundingClientRect();return rect(track.x,track.y+(parseFloat(card.style.top)||0),140,parseFloat(card.style.height)||28);}
  return rect(0,0,390,740);
 }
}
function rect(x,y,width,height){return {x,y,left:x,top:y,right:x+width,bottom:y+height,width,height};}
function simple(node,selector){
 const attrs=[...selector.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']*)["']?)?\]/g)];
 for(const attr of attrs){const value=node.getAttribute(attr[1]);if(value===null||(attr[2]!==undefined&&value!==attr[2]))return false;}
 const rest=selector.replace(/\[[^\]]+\]/g,''),tag=rest.match(/^[a-z][\w-]*/i)?.[0];
 if(tag&&node.tagName!==tag.toUpperCase())return false;
 for(const item of rest.matchAll(/([.#])([\w-]+)/g))if(item[1]==='.'?!node.classList.contains(item[2]):node.getAttribute('id')!==item[2])return false;
 return !!selector&&!rest.includes(':');
}
function match(node,parts){let index=parts.length-1;if(!simple(node,parts[index]))return false;for(index--;index>=0;index--){do{node=node.parentElement;}while(node&&!simple(node,parts[index]));if(!node)return false;}return true;}
function parse(root,html){
 const stack=[root],voids=new Set(['input','img','br','hr','meta','link']);
 for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
  if(token.startsWith('</')){const tag=token.slice(2,-1).trim().toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break;}continue;}
  if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const node=new Element(tag,root.ownerDocument);
   const text=token.slice(tag.length+1).replace(/\/?>$/,'');
   for(const attr of text.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(attr[1],decode(attr[2]??attr[3]??attr[4]??''));
   stack.at(-1).append(node);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1).childNodes.push({nodeType:3,textContent:decode(token)});
 }
}
function emit(surface,type,target,extra={}){
 const event=new Event(type,{bubbles:true,cancelable:type!=='pointercancel'});
 for(const [key,value]of Object.entries({pointerId:7,pointerType:'touch',isPrimary:true,button:0,clientX:100,clientY:300,target,...extra}))Object.defineProperty(event,key,{value,configurable:true});
 surface.dispatchEvent(event);return event;
}

async function sheet(focus='b',productionDialog=false,extraTasks=[],beforeFirstFrame=null,capabilities={}){
 const doc=new EventTarget(),win=new EventTarget(),disk=new Map(),timers=new Map(),frames=new Map(),pending=new Set(),writes=[],requests=[],created=[],messages=[],subscribers=new Set();let seq=0,frameTime=0,writeFailure=null,currentEditor=null;
 doc.documentElement=new Element('html',doc);doc.documentElement._connected=true;doc.body=new Element('body',doc);doc.documentElement.append(doc.body);doc.activeElement=null;
 doc.createElement=tag=>new Element(tag,doc);doc.querySelector=selector=>doc.documentElement.querySelector(selector);doc.querySelectorAll=selector=>doc.documentElement.querySelectorAll(selector);doc.getElementById=id=>doc.querySelector('#'+id);
 for(const id of ['app','modalRoot','toastRoot','syncLabel','syncButton','connectionNotice','environmentLabel']){const node=doc.createElement('div');node.setAttribute('id',id);doc.body.append(node);}
 const context={console,document:doc,addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win),innerWidth:390,innerHeight:740,navigator:capabilities.navigator||{},
  matchMedia:query=>({matches:query.includes('prefers-reduced-motion')?!!capabilities.reducedMotion:query.includes('max-width')}),getComputedStyle:()=>({getPropertyValue:name=>name==='--flow-step'?'120px':''}),
  setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id),
  localStorage:{get length(){return disk.size;},key:index=>[...disk.keys()][index]??null,getItem:key=>disk.get(key)??null,setItem:(key,value)=>disk.set(key,String(value)),removeItem:key=>disk.delete(key)},Node:{TEXT_NODE:3,ELEMENT_NODE:1}};
 context.window=context;doc.defaultView=context;vm.createContext(context);for(const [file,source]of scripts)vm.runInContext(source,context,{filename:file});
 const rows=Object.fromEntries(Object.keys(Store.IDS).map(key=>[key,[]]));
 rows.tasks=[{_id:'a','任务标题':'任务 A','任务详情':'正文 A','任务状态':'收集（未开始）','计划开始时间':DAY+'T09:00:00Z','计划截止时间':DAY+'T10:00:00Z'},{_id:'b','任务标题':'任务 B','任务详情':'正文 B','任务状态':'收集（未开始）','计划开始时间':DAY+'T11:00:00Z','计划截止时间':DAY+'T12:00:00Z'}];
 rows.tasks.push(...extraTasks);
 const table=id=>Object.keys(Store.IDS).find(key=>Store.IDS[key]===id);
 const store=Store.createStore({query:async params=>({results:copy(rows[table(params.databaseId)]),hasMore:false}),updateRecord:async params=>{writes.push(copy(params));if(writeFailure)throw writeFailure;const row=rows[table(params.databaseId)].find(item=>item._id===params.recordId);for(const [key,value]of Object.entries(params.properties))row[key]=Object.values(value)[0];return copy(row);}});await store.read();
 const subscribe=store.subscribe;store.subscribe=fn=>{subscribers.add(fn);const unsubscribe=subscribe(fn);return()=>{subscribers.delete(fn);unsubscribe();};};
 const L=context.OneDayLite;L.store=store;L.toast=message=>messages.push(message);L.newTaskDialog=values=>created.push(copy(values));
 L.saveTaskSchedule=async(id,props,base,options)=>{requests.push({id,props:copy(props),base:copy(base),options});return true;};
 const run=L.run;L.run=(...args)=>{const flight=run(...args);pending.add(flight);flight.finally(()=>pending.delete(flight));return flight;};
 // Markdown rendering has its own tests. This surface still participates in
 // the real Day draft lifecycle, including release/flush during selection/close.
 context.OneDayLiteEditor={mount(_host,options){let value=options.value,readOnly=false;currentEditor={getValue:()=>value,setValue:next=>value=next,setReadOnly:next=>readOnly=next,get readOnly(){return readOnly;},type(next){if(readOnly)throw Error('editor is read only');value=next;options.onChange(value);},flush:()=>value,destroy(){},pendingUploads:0,whenReady:async()=>value};return currentEditor;}};
 let api,element,root;
 if(productionDialog){api=L.openDayTimeline(DAY,focus);element=api.element;root=api.q('#dayTimelineRoot');}
 else {
  element=doc.createElement('div');const dialog=doc.createElement('section'),header=doc.createElement('header');header.className='dialog-header';root=doc.createElement('div');root.setAttribute('id','dayTimelineRoot');element.append(dialog);dialog.append(header,root);doc.body.append(element);
  let config;api={element,root:dialog,q:selector=>element.querySelector(selector),qa:selector=>element.querySelectorAll(selector),closed:false,async close(){if(await config.onClose()===false)return false;this.closed=true;element.remove();return true;}};
  L.dialog=options=>{config=options;options.onMount(api);return api;};L.openDayTimeline(DAY,focus);
 }
 async function frame(ms=16){frameTime+=ms;for(const [id,fn]of [...frames]){frames.delete(id);await fn(frameTime);}}
 async function settle(){for(let round=0;round<30;round++){await frame();for(const [id,{fn}]of [...timers]){timers.delete(id);await fn();}if(pending.size)await Promise.all([...pending]);await Promise.resolve();if(!frames.size&&!timers.size&&!pending.size)return;}throw Error('Day Sheet did not settle');}
 if(beforeFirstFrame)beforeFirstFrame({root,api,element});
 await settle();
 const x={L,store,doc,win,root,api,writes,requests,created,messages,settle,frame,get frameCount(){return frames.size;},async flushUI(){for(const [id,{fn}]of [...timers]){timers.delete(id);await fn();}await frame();},card:id=>root.querySelector('.day-main-pane .day-task-card[data-task-id="'+id+'"]'),track:()=>root.querySelector('.day-main-pane .day-timeline-track'),title:()=>root.querySelector('[data-day-task-title]')?.textContent||root.querySelector('[data-task-title-editor]')?.value||'',bands:()=>root.querySelectorAll('.day-select-band').length,
  failWrites:error=>writeFailure=error,get editor(){return currentEditor;},input:target=>emit(element,'input',target),
  down:(target,extra={})=>emit(element,'pointerdown',target,extra),move:(target,extra={})=>emit(doc,'pointermove',target,extra),up:(target,extra={})=>emit(doc,'pointerup',target,extra),cancel:(target,extra={})=>emit(doc,'pointercancel',target,extra),key:(target,key)=>emit(element,'keydown',target,{key}),notify:()=>{for(const fn of subscribers)fn();}};
 A.ok(x.card('a'));A.equal(x.title(),focus==='a'?'任务 A':focus==='b'?'任务 B':'');A.deepEqual(messages,[]);return x;
}
function center(card){const box=card.getBoundingClientRect();return {clientX:box.x+box.width/2,clientY:box.y+box.height/2};}
function time(x,id='a'){return x.card(id).querySelector('.day-card-time').textContent;}
function grip(card,selector){const target=card.querySelector(selector);A.ok(target,'the selected task exposes the requested edit grip');return target;}

for(const focus of ['a','b'])test('Day touch '+(focus==='a'?'selected':'unselected')+' card-body movement drags after the threshold and commits once',async()=>{
 const x=await sheet(focus),card=x.card('a'),start=center(card);x.down(card,start);x.move(card,{...start,clientY:start.clientY+3});A.equal(time(x),'09:00–10:00');
 x.move(card,{...start,clientY:start.clientY+48});A.equal(time(x),'10:00–11:00');A.equal(x.requests.length,0);
 x.up(card,{...start,clientY:start.clientY+48});x.up(card,{...start,clientY:start.clientY+48});await x.settle();
 A.equal(x.title(),focus==='a'?'任务 A':'任务 B');A.equal(x.requests.length,1);A.deepEqual(x.requests[0].props,{'计划开始时间':{date:DAY+'T10:00:00Z'},'计划截止时间':{date:DAY+'T11:00:00Z'}});A.equal(x.writes.length,0);A.equal(x.created.length,0);
});
test('Day touch blank swipe never shows a range band or opens creation',async()=>{
 const x=await sheet(),track=x.track(),start={clientX:100,clientY:track.getBoundingClientRect().top+13*48};x.down(track,start);A.equal(x.bands(),0);
 x.move(track,{...start,clientY:start.clientY+80});x.up(track,{...start,clientY:start.clientY+80});await x.settle();
 A.equal(x.bands(),0);A.equal(x.created.length,0);A.equal(x.requests.length,0);A.equal(x.writes.length,0);
});
test('Day touch card tap selects the task in the adjacent detail panel',async()=>{
 const x=await sheet(),card=x.card('a'),start=center(card);x.down(card,start);x.up(card,start);await x.settle();A.equal(x.title(),'任务 A');A.equal(x.requests.length,0);A.equal(x.created.length,0);
});
test('Day touch blank tap creates one snapped default hour',async()=>{
 const x=await sheet(),track=x.track(),start={clientX:100,clientY:track.getBoundingClientRect().top+13*48+11};x.down(track,start);x.up(track,start);await x.settle();
 A.deepEqual(x.created,[{date:DAY,parent:'',start:'13:10'}]);A.equal(x.bands(),0);A.equal(x.requests.length,0);A.equal(x.writes.length,0);
});
test('Day explicit touch move grip commits one planned interval',async()=>{
 const x=await sheet('a'),card=x.card('a'),target=grip(card,'[data-day-move]'),start=center(card);x.down(target,start);x.move(target,{...start,clientY:start.clientY+48});A.equal(x.requests.length,0);
 x.up(target,{...start,clientY:start.clientY+48});x.up(target,{...start,clientY:start.clientY+96});await x.settle();
 A.equal(x.requests.length,1);A.equal(x.requests[0].id,'a');A.deepEqual(x.requests[0].props,{'计划开始时间':{date:DAY+'T10:00:00Z'},'计划截止时间':{date:DAY+'T11:00:00Z'}});A.equal(x.writes.length,0);
});
test('Day canceled touch resize restores the displayed interval without saving',async()=>{
 const x=await sheet('a'),card=x.card('a'),target=grip(card,'[data-resize="end"]'),start=center(card),before=time(x);
 x.down(target,start);x.move(target,{...start,clientY:start.clientY+24});A.notEqual(time(x),before);x.cancel(target,{...start,clientY:start.clientY+24});x.up(target,{...start,clientY:start.clientY+48});await x.settle();
 A.equal(time(x),before);A.equal(x.card('a').classList.contains('dragging'),false);A.equal(x.requests.length,0);A.equal(x.writes.length,0);
});
test('Day refresh during mouse drag retains the active card and pointerdown edit base',async()=>{
 const x=await sheet('a'),card=x.card('a'),start={...center(card),pointerType:'mouse'},base=copy(x.L.find('a'));
 x.down(card,start);x.move(card,{...start,clientY:start.clientY+48});x.L.find('a')['任务标题']='远端更新的任务 A';x.notify();await x.settle();A.equal(card.isConnected,true);
 x.up(card,{...start,clientY:start.clientY+48});await x.settle();A.equal(x.requests.length,1);A.deepEqual(x.requests[0].base,base);A.equal(x.requests[0].props['计划开始时间'].date,DAY+'T10:00:00Z');
});
test('Day mouse movement returning to its original interval performs no schedule request',async()=>{
 const x=await sheet('a'),card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.move(card,{...start,clientY:start.clientY+8});x.move(card,start);x.up(card,start);await x.settle();
 A.equal(x.requests.length,0);A.equal(x.writes.length,0);A.equal(time(x),'09:00–10:00');
});
test('Day ignores another pointer while a mouse edit is active',async()=>{
 const x=await sheet('a'),card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);
 x.move(card,{...start,pointerId:8,clientY:start.clientY+48});x.up(card,{...start,pointerId:8,clientY:start.clientY+48});await x.settle();A.equal(x.requests.length,0);A.equal(x.writes.length,0);A.equal(time(x),'09:00–10:00');
 x.move(card,{...start,clientY:start.clientY+48});x.up(card,{...start,clientY:start.clientY+48});await x.settle();A.equal(x.requests.length,1);
});
test('Day ignores a secondary touch beginning on empty time',async()=>{
 const x=await sheet(),track=x.track(),start={clientX:100,clientY:track.getBoundingClientRect().top+13*48,pointerId:8,isPrimary:false};x.down(track,start);x.up(track,start);await x.settle();A.equal(x.created.length,0);A.equal(x.bands(),0);A.equal(x.requests.length,0);
});
test('closing Day tears down an active edit before its later pointerup',async()=>{
 const x=await sheet('a'),card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.move(card,{...start,clientY:start.clientY+48});A.equal(await x.api.close(),true);
 x.up(card,{...start,clientY:start.clientY+48});await x.settle();A.equal(x.api.closed,true);A.equal(x.requests.length,0);A.equal(x.writes.length,0);
});
for(const key of ['Enter',' '])test('Day keyboard '+(key===' '?'Space':key)+' selects a focused task card',async()=>{
 const x=await sheet(),card=x.card('a');card.focus();const event=x.key(card,key);await x.settle();A.equal(x.title(),'任务 A');A.equal(event.defaultPrevented,true);A.equal(x.requests.length,0);A.equal(x.created.length,0);
});

test('Day refused close removes its canceled conflict and retains editable title/body drafts',async()=>{
 const x=await sheet('a'),choices=[];let confirmations=0;
 x.failWrites(Error('offline'));x.L.confirm=async()=>{confirmations++;return false;};
 x.editor.type('未保存的任务标题\n\n尚未保存的正文');
 x.L.saveTaskSchedule=async(id,props,base,options)=>{
  x.requests.push({id,props:copy(props),base:copy(base),options});
  const candidate={...base,...Object.fromEntries(Object.entries(props).map(([key,value])=>[key,Object.values(value)[0]]))};
  const plan=x.L.C.schedulePlan(x.L.tasks(),candidate);A.equal(plan.conflicts.length,1);
  choices.push(await options.present(plan));return null;
 };
 const card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.move(card,{...start,clientY:start.clientY+96});x.up(card,{...start,clientY:start.clientY+96});
 A.ok(x.root.querySelector('[data-timeline-conflict]'),'the actual schedule presenter opens the conflict panel');
 A.equal(await x.api.close(),false);await x.settle();
 A.equal(confirmations,1);A.deepEqual(choices,['cancel']);A.equal(x.api.closed,false);A.equal(x.api.root.inert,false);A.equal(x.root.isConnected,true);
 A.equal(x.title(),'未保存的任务标题');A.equal(x.editor.getValue(),'未保存的任务标题\n\n尚未保存的正文');A.equal(x.editor.readOnly,false);
 A.deepEqual(copy(x.L.read('draft.tasks.a').fields),{'任务标题':'未保存的任务标题','任务详情':'未保存的任务标题\n\n尚未保存的正文'});
 A.equal(x.requests.length,1);A.ok(x.writes.length>0,'closing attempted the real draft save');
 A.equal(x.writes.some(write=>Object.keys(write.properties).some(key=>key==='计划开始时间'||key==='计划截止时间')),false);A.equal(x.L.find('a')['计划开始时间'],DAY+'T09:00:00Z');
 A.equal(!!x.root.querySelector('[data-timeline-conflict]'),false,'a canceled conflict must not remain visible after the close is refused');
});

for(const edit of ['move','resize'])test('production Day dialog stays open after '+edit+' and a retargeted backdrop click',async()=>{
 const x=await sheet('a',true),card=x.card('a'),target=edit==='resize'?grip(card,'[data-resize="end"]'):card,start={...center(card),pointerType:'mouse'};
 let closeFlight;const close=x.api.close;x.api.close=(...args)=>closeFlight=close(...args);
 x.down(target,start);x.move(target,{...start,clientY:start.clientY+24});x.up(x.api.element,{...start,clientY:start.clientY+24});await x.settle();
 emit(x.api.element,'click',x.api.element,{...start,clientY:start.clientY+24});if(closeFlight)await closeFlight;await x.settle();
 A.equal(x.requests.length,1);A.equal(x.api.element.isConnected,true);A.equal(x.L.modalStack.length,1);
 // A fresh deliberate backdrop click must still dismiss the same production dialog.
 x.down(x.api.element,{pointerType:'mouse'});x.up(x.api.element,{pointerType:'mouse'});emit(x.api.element,'click',x.api.element,{pointerType:'mouse'});await closeFlight;await x.settle();
 A.equal(x.api.element.isConnected,false);A.equal(x.L.modalStack.length,0);
});

test('Day shows undated active tasks and explicitly schedules them on the viewed day',async()=>{
 const x=await sheet('a',false,[{_id:'pending','任务标题':'待分配工作','任务状态':'收集（未开始）','预计时长':80},{_id:'done','任务标题':'已完成的待办','任务状态':'完成'}]),plans=[];
 x.L.openPlan=(id,context)=>plans.push({id,...context});
 const item=x.root.querySelector('[data-day-park-id="pending"]');A.ok(item,'undated nonterminal work appears in parking');A.equal(!!x.root.querySelector('[data-day-park-id="done"]'),false);
 const schedule=item.querySelector('[data-day-action="schedule"]');A.ok(schedule,'parking exposes a touch-friendly scheduling action');emit(x.api.element,'click',schedule);
 A.deepEqual(plans,[{id:'pending',date:DAY}]);A.equal(x.requests.length,0);
});
test('Day content derives the display title without a separate editable title field',async()=>{
 const x=await sheet('a');A.equal(!!x.root.querySelector('[data-task-title-editor]'),false);A.equal(x.editor.getValue(),'任务 A\n\n正文 A');
 x.editor.type('# 新的首行\n\n完整正文');A.equal(x.title(),'新的首行');await x.settle();A.equal(x.L.find('a')['任务标题'],'新的首行');A.equal(x.L.find('a')['任务详情'],'# 新的首行\n\n完整正文');
});
test('Day deletion flushes the current content before invoking recoverable delete and clears selection',async()=>{
 const x=await sheet('a'),deleted=[];x.editor.type('删除前最后输入\n\n保存正文');x.L.deleteTask=async id=>{deleted.push({id,title:x.L.find(id)['任务标题'],body:x.L.find(id)['任务详情']});x.L.find(id)['回收站']=true;return true;};
 const button=x.root.querySelector('[data-day-action="delete"]');A.ok(button,'delete is visible in the selected task panel');emit(x.api.element,'click',button);await x.settle();
 A.deepEqual(deleted,[{id:'a',title:'删除前最后输入',body:'删除前最后输入\n\n保存正文'}]);A.equal(!!x.card('a'),false);A.equal(x.title(),'');
});
test('failed Day content flush prevents deletion and keeps the editable draft',async()=>{
 const x=await sheet('a');let deletes=0;x.L.deleteTask=async()=>{deletes++;return true;};x.failWrites(Error('offline'));x.editor.type('失败仍保留的内容');
 const button=x.root.querySelector('[data-day-action="delete"]');A.ok(button);emit(x.api.element,'click',button);await x.settle();
 A.equal(deletes,0);A.equal(x.editor.getValue(),'失败仍保留的内容');A.ok(x.L.read('draft.tasks.a'));A.equal(x.api.element.isConnected,true);
});

test('Day near-midnight tap passes start context without shortening the default duration',async()=>{
 const x=await sheet(),track=x.track(),start={clientX:100,clientY:track.getBoundingClientRect().top+23.8*48};x.down(track,start);x.up(track,start);await x.settle();
 A.deepEqual(x.created,[{date:DAY,parent:'',start:'23:50'}]);
});
test('canceling recoverable Day deletion keeps the selected task and content editor',async()=>{
 const x=await sheet('a');let deletes=0;x.L.deleteTask=async()=>{deletes++;return false;};x.editor.type('保留的任务内容');
 emit(x.api.element,'click',x.root.querySelector('[data-day-action="delete"]'));await x.settle();
 A.equal(deletes,1);A.equal(x.title(),'保留的任务内容');A.equal(x.editor.getValue(),'保留的任务内容');A.ok(x.card('a'));A.equal(x.api.element.isConnected,true);
});

test('Day retains timeline scroll when two paints happen before the restore frame',async()=>{
 const x=await sheet('a'),scroll=x.root.querySelector('.day-main-pane .day-timeline-scroll');scroll.scrollTop=535;
 emit(x.api.element,'click',x.root.querySelector('[data-day-action="tab"][data-tab="logs"]'));
 emit(x.api.element,'click',x.root.querySelector('[data-day-action="tab"][data-tab="content"]'));await x.settle();
 A.equal(x.root.querySelector('.day-main-pane .day-timeline-scroll').scrollTop,535);
});
test('Day first-open default scroll survives a repaint before its first frame',async()=>{
 const x=await sheet('a',false,[],({root,element})=>{
  emit(element,'click',root.querySelector('[data-day-action="tab"][data-tab="logs"]'));
  emit(element,'click',root.querySelector('[data-day-action="tab"][data-tab="content"]'));
 });
 A.equal(x.root.querySelector('.day-main-pane .day-timeline-scroll').scrollTop,384,'first planned09:00 task defaults to08:00, rather than midnight');
});

test('Day 1.7 has one independent cyclic coverflow and two centered detail tabs',async()=>{
 const x=await sheet('a',false,[{_id:'todo','任务标题':'待办卡片','任务状态':'收集（未开始）'}]);
 A.ok(x.root.querySelector('[data-day-coverflow]'));
 A.equal(x.root.querySelector('.day-axis-group .day-parking'),null);
 A.deepEqual(x.root.querySelectorAll('[data-day-action="tab"]').map(node=>node.dataset.tab),['content','logs']);
 A.ok(x.root.querySelector('[data-day-status-rail]'));
 A.ok(x.root.querySelector('[data-day-quadrant]'));
 A.ok(x.root.querySelector('[data-day-action="new-child"]'));
});

test('Day 1.7 double-clicking a parent shows unplanned children with inherited display ranges',async()=>{
 const x=await sheet('a',false,[{_id:'child','任务标题':'先写提纲','任务状态':'收集（未开始）','任务类型':'子任务','父任务ID':'a'}]);
 emit(x.api.element,'dblclick',x.card('a'),{pointerType:'mouse'});await x.settle();
 const child=x.root.querySelector('.day-sub-pane .day-task-card[data-task-id="child"]');A.ok(child);
 A.match(child.textContent,/跟随父任务/);
 A.equal(x.L.find('child')['计划开始时间'],undefined,'inherited display does not fabricate a saved plan');
});

function saveSchedules(x){x.L.saveTaskSchedule=async(id,props,base,options)=>{x.requests.push({id,props:copy(props),base:copy(base),options});return x.store.patch('tasks',id,props,base,{optimistic:true});};}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function todo(id,estimate=60){return {_id:id,'任务标题':'待办 '+id,'任务状态':'收集（未开始）','预计时长':estimate};}

test('Day cyclic coverflow wraps buttons and touch horizontal swipes without scheduling',async()=>{
 const x=await sheet('a',false,[todo('p'),todo('q'),todo('r')]);
 const front=()=>x.root.querySelector('.day-flow-card.is-front').dataset.dayParkId;
 A.equal(front(),'p');emit(x.api.element,'click',x.root.querySelector('[data-day-action="flow-prev"]'));await x.settle();A.equal(front(),'r');
 emit(x.api.element,'click',x.root.querySelector('[data-day-action="flow-next"]'));await x.settle();A.equal(front(),'p');
 const card=x.root.querySelector('.day-flow-card.is-front'),start={clientX:195,clientY:125};x.down(card,start);x.move(card,{clientX:110,clientY:128});x.up(card,{clientX:110,clientY:128});await x.settle();
 A.equal(front(),'q');A.equal(x.requests.length,0);A.equal(x.writes.length,0);A.equal(x.root.querySelector('[data-flow-counter]').textContent,'2 / 3');
});

test('Day release geometry survives a refresh while the cloud save is still pending and rolls back on failure',async()=>{
 const x=await sheet('a'),saving=gate();x.L.saveTaskSchedule=()=>saving.promise;
 const card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.move(card,{...start,clientY:start.clientY+48});x.up(card,{...start,clientY:start.clientY+48});
 A.equal(time(x),'10:00–11:00','pointerup paints the requested position before network completion');
 x.notify();await x.flushUI();A.equal(time(x),'10:00–11:00','a store repaint must not snap the pending task back');
 saving.reject(Error('cloud offline'));await x.settle();A.equal(time(x),'09:00–10:00');A.ok(x.messages.includes('cloud offline'));
});

test('Day coverflow vertical drag schedules the same task immediately in the chosen interval',async()=>{
 const x=await sheet('a',false,[todo('p',70)]);saveSchedules(x);
 const card=x.root.querySelector('[data-day-park-id="p"]'),track=x.track(),y=track.getBoundingClientRect().top+13*48;
 x.down(card,{clientX:195,clientY:125,pointerType:'mouse'});x.move(card,{clientX:110,clientY:y,pointerType:'mouse'});x.up(card,{clientX:110,clientY:y,pointerType:'mouse'});await x.settle();
 A.equal(x.requests.length,1);A.equal(x.requests[0].id,'p');A.equal(x.L.find('p')['计划开始时间'],DAY+'T13:00:00Z');A.equal(x.L.find('p')['计划截止时间'],DAY+'T14:10:00Z');A.ok(x.card('p'));A.equal(x.root.querySelector('[data-day-park-id="p"]'),null);
});

for(const pointerType of ['mouse','touch'])test('Day coverflow '+pointerType+' diagonal drag from the center into the main timeline schedules instead of cycling',async()=>{
 const x=await sheet('a',false,[todo('p',70),todo('q'),todo('r')]);saveSchedules(x);
 // Match the desktop three-pane geometry that makes the natural drop more
 // horizontal than vertical; initial movement is deliberately a gallery swipe.
 x.root.querySelector('[data-day-coverflow]').getBoundingClientRect=()=>rect(240,76,840,132);
 x.track().getBoundingClientRect=()=>rect(60,361-12*48,300,1152);
 x.root.querySelector('.day-main-pane .day-timeline-scroll').getBoundingClientRect=()=>rect(30,250,360,500);
 const card=x.root.querySelector('[data-day-park-id="p"]');
 x.down(card,{clientX:662,clientY:151,pointerType});x.move(card,{clientX:600,clientY:160,pointerType});x.move(card,{clientX:213,clientY:361,pointerType});
 A.ok(x.root.querySelector('.day-drop-preview'),'entering the timeline changes the swipe into a scheduling preview');A.equal(x.requests.length,0);
 x.up(card,{clientX:213,clientY:361,pointerType});await x.settle();
 A.equal(x.requests.length,1);A.equal(x.requests[0].id,'p');A.equal(x.L.find('p')['计划开始时间'],DAY+'T12:00:00Z');A.equal(x.L.find('p')['计划截止时间'],DAY+'T13:10:00Z');A.ok(x.card('p'));A.equal(x.root.querySelector('[data-day-park-id="p"]'),null);
});

test('Day coverflow swipe can become a top-trash drop before release',async()=>{
 const x=await sheet('a',false,[todo('p'),todo('q')]),saving=gate();let options;
 x.L.deleteTask=(id,settings)=>{A.equal(id,'p');options=settings;return saving.promise;};
 const card=x.root.querySelector('[data-day-park-id="p"]');
 x.down(card,{clientX:195,clientY:125,pointerType:'mouse'});x.move(card,{clientX:110,clientY:125,pointerType:'mouse'});x.move(card,{clientX:195,clientY:25,pointerType:'mouse'});
 A.ok(x.api.element.classList.contains('day-over-trash'),'the trash target takes over from the initial horizontal swipe');
 x.up(card,{clientX:195,clientY:25,pointerType:'mouse'});A.equal(x.root.querySelector('[data-day-park-id="p"]'),null);A.equal(options.confirm,false);A.equal(x.requests.length,0);
 saving.resolve(false);await x.settle();A.ok(x.root.querySelector('[data-day-park-id="p"]'));
});

for(const estimate of [70,480])test('Day late coverflow drop keeps all '+estimate+' minutes across midnight',async()=>{
 const x=await sheet('a',false,[todo('late',estimate)]);saveSchedules(x);x.root.querySelector('.day-main-pane .day-timeline-scroll').scrollTop=1000;
 const card=x.root.querySelector('[data-day-park-id="late"]'),track=x.track(),y=track.getBoundingClientRect().top+1430/60*48;
 x.down(card,{clientX:195,clientY:125,pointerType:'mouse'});x.move(card,{clientX:110,clientY:y,pointerType:'mouse'});x.up(card,{clientX:110,clientY:y,pointerType:'mouse'});await x.settle();
 A.equal(x.requests.length,1);A.equal(x.L.find('late')['计划开始时间'],DAY+'T23:50:00Z');
 A.equal((Date.parse(x.L.find('late')['计划截止时间'])-Date.parse(x.L.find('late')['计划开始时间']))/60000,estimate);
 A.equal(x.L.find('late')['计划截止时间'].slice(0,10),'2026-10-20');A.ok(x.card('late'),'a cross-midnight schedule appears on the timeline');A.equal(x.root.querySelector('[data-day-park-id="late"]'),null,'scheduled spans leave coverflow');
});

test('Day timeline task dropped in coverflow clears its planned dates',async()=>{
 const x=await sheet('a');saveSchedules(x);const card=x.card('a'),start={...center(card),pointerType:'mouse'};
 x.down(card,start);x.move(card,{clientX:195,clientY:130,pointerType:'mouse'});x.up(card,{clientX:195,clientY:130,pointerType:'mouse'});await x.settle();
 A.equal(x.L.find('a')['计划开始时间'],null);A.equal(x.L.find('a')['计划截止时间'],null);A.equal(x.card('a'),null);A.ok(x.root.querySelector('[data-day-park-id="a"]'));
});

test('Day top trash drop hides immediately and its undo callback restores before cloud completion',async()=>{
 const x=await sheet('a'),saving=gate();let options; x.L.deleteTask=(id,settings)=>{A.equal(id,'a');options=settings;return saving.promise;};
 const card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.move(card,{clientX:195,clientY:25,pointerType:'mouse'});x.up(card,{clientX:195,clientY:25,pointerType:'mouse'});
 A.equal(x.card('a'),null);A.equal(options.confirm,false);A.equal(typeof options.beforeDelete,'function');A.equal(typeof options.onUndo,'function');
 options.onUndo();A.ok(x.card('a'));saving.resolve(false);await x.settle();A.equal(x.api.element.isConnected,true);A.ok(x.card('a'));
});

test('Day quadrant dragging saves the selected important/urgent quadrant',async()=>{
 const x=await sheet('a'),quadrant=x.root.querySelector('[data-day-quadrant]');
 x.down(quadrant,{clientX:235,clientY:455,pointerType:'mouse'});x.move(quadrant,{clientX:360,clientY:414,pointerType:'mouse'});x.up(quadrant,{clientX:360,clientY:414,pointerType:'mouse'});await x.settle();
 A.equal(x.L.find('a')['优先级'],'紧急');A.equal(x.writes.filter(write=>write.properties['优先级']).length,1);
});

test('Day content and log tabs follow pointer movement and preserve form gestures',async()=>{
 const x=await sheet('a');
 const swipe=(dx,form=false)=>{const pane=x.root.querySelector('[data-day-pane]'),target=form?x.root.querySelector('[data-day-worklog] textarea'):pane;emit(pane,'pointerdown',target,{clientX:280,clientY:400});emit(pane,'pointermove',target,{clientX:280+dx,clientY:405});if(!form)A.match(pane.querySelector('.swipe-current').style.transform,/translateX/);emit(x.doc,'pointerup',target,{clientX:280+dx,clientY:405});};
 swipe(-120);await x.settle();A.ok(x.root.querySelector('[data-day-pane="logs"]'));
 swipe(120,true);await x.settle();A.ok(x.root.querySelector('[data-day-pane="logs"]'),'textarea swipes retain the logs tab');
 swipe(120);await x.settle();A.ok(x.root.querySelector('[data-day-pane="content"]'));
});

test('Day child creation button preserves its parent and opens the shared unscheduled capture',async()=>{
 const x=await sheet('a');emit(x.api.element,'click',x.root.querySelector('[data-day-action="new-child"]'));await x.settle();
 A.deepEqual(x.created,[{parent:'a'}]);A.ok(x.root.querySelector('.day-sub-pane'));
});


test('Day moving a cross-midnight segment keeps the entire task duration',async()=>{
 const late=()=>({_id:'late','任务标题':'跨日事项','任务状态':'收集（未开始）','计划开始时间':DAY+'T23:50:00Z','计划截止时间':'2026-10-20T01:00:00Z'});
 const x=await sheet('a',false,[late()]);saveSchedules(x);x.root.querySelector('.day-main-pane .day-timeline-scroll').scrollTop=1000;
 const card=x.card('late'),start={...center(card),pointerType:'mouse'};A.ok(card);x.down(card,start);x.move(card,{...start,clientY:start.clientY-48});x.up(card,{...start,clientY:start.clientY-48});await x.settle();
 A.equal(x.L.find('late')['计划开始时间'],DAY+'T22:50:00Z');A.equal(x.L.find('late')['计划截止时间'],'2026-10-20T00:00:00Z');A.equal((Date.parse(x.L.find('late')['计划截止时间'])-Date.parse(x.L.find('late')['计划开始时间']))/60000,70);
});

test('Day mouse selection is immediate and a second tap opens children without a selection timer',async()=>{
 const x=await sheet('b',false,[{_id:'child','任务标题':'子任务','任务类型':'子任务','父任务ID':'a','任务状态':'收集（未开始）'}]);
 let card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.up(card,start);A.equal(x.title(),'任务 A');await x.settle();
 card=x.card('a');start={...center(card),pointerType:'mouse'};x.down(card,start);x.up(card,start);A.ok(x.root.querySelector('.day-sub-pane'));await x.settle();
});

test('Day header + and its public creation callback open generic capture synchronously and preserve the workspace',async()=>{
 const x=await sheet('a',true),opened=[],result={creation:true},editor=x.editor,host=x.root.querySelector('[data-day-editor-host]'),scroll=x.root.querySelector('.day-main-pane .day-timeline-scroll');scroll.scrollTop=520;
 x.L.openCreationSheet=(...args)=>{opened.push(args);return result;};
 const button=x.api.root.querySelector('.dialog-header [data-day-action="create"]');A.ok(button,'the popup header exposes its own creation button');A.equal(typeof x.api.createRecord,'function');
 emit(x.api.element,'click',button);A.deepEqual(opened,[[]],'the activation handler opens capture immediately without injecting a day or time');
 A.strictEqual(x.api.createRecord(),result);A.deepEqual(opened,[[],[]]);
 A.strictEqual(x.editor,editor);A.strictEqual(x.root.querySelector('[data-day-editor-host]'),host);A.strictEqual(x.root.querySelector('.day-main-pane .day-timeline-scroll'),scroll);A.equal(scroll.scrollTop,520);A.equal(x.L.modalStack.length,1);
});

for(const finish of ['commit','cancel','close'])test('Day drag time feedback floats outside clipping, stays inside the viewport and clears on '+finish,async()=>{
 const x=await sheet('a'),card=x.card('a'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.move(card,{...start,clientY:start.clientY+24});
 let bubble=x.doc.querySelector('.day-time-feedback');A.ok(bubble);A.equal(bubble.style.position,'fixed');A.equal(x.track().contains(bubble),false);A.equal(bubble.textContent,'09:30–10:30');
 let box=bubble.getBoundingClientRect();A.ok(box.bottom<center(card).clientY,'feedback sits above the dragged card/finger');
 x.move(card,{clientX:-50,clientY:15,pointerType:'mouse'});bubble=x.doc.querySelector('.day-time-feedback');box=bubble.getBoundingClientRect();A.ok(box.left>=8&&box.right<=382);A.ok(box.top>=8&&box.bottom<=732);
 x.move(card,{clientX:1000,clientY:900,pointerType:'mouse'});box=bubble.getBoundingClientRect();A.ok(box.left>=8&&box.right<=382);A.ok(box.top>=8&&box.bottom<=732);
 if(finish==='close')await x.api.close();else x[finish==='commit'?'up':'cancel'](card,{clientX:1000,clientY:900,pointerType:'mouse'});
 A.equal(x.doc.querySelector('.day-time-feedback'),null);A.equal(x.api.element.classList.contains('day-is-dragging'),false);await x.settle();
 if(finish!=='commit')A.equal(x.requests.length,0);
});

test('Day cross-midnight movement feedback shows the full range and saves that same interval',async()=>{
 const x=await sheet('a',false,[{_id:'late','任务标题':'跨日','任务状态':'收集（未开始）','计划开始时间':DAY+'T23:50:00Z','计划截止时间':'2026-10-20T01:00:00Z'}]);x.root.querySelector('.day-main-pane .day-timeline-scroll').scrollTop=1000;
 const card=x.card('late'),start={...center(card),pointerType:'mouse'};x.down(card,start);x.move(card,{...start,clientY:start.clientY-8});
 A.equal(x.doc.querySelector('.day-time-feedback')?.textContent,'23:40–00:50 · 次日结束');x.up(card,{...start,clientY:start.clientY-8});await x.settle();
 A.deepEqual(x.requests[0].props,{'计划开始时间':{date:DAY+'T23:40:00Z'},'计划截止时间':{date:'2026-10-20T00:50:00Z'}});
});

test('Day resizing a clipped cross-midnight end changes the full endpoint without discarding the next-day segment',async()=>{
 const x=await sheet('a',false,[{_id:'late','任务标题':'跨日','任务状态':'收集（未开始）','计划开始时间':DAY+'T22:00:00Z','计划截止时间':'2026-10-20T01:00:00Z'}]);x.root.querySelector('.day-main-pane .day-timeline-scroll').scrollTop=1000;
 const card=x.card('late'),edge=grip(card,'[data-resize="end"]'),start={...center(card),pointerType:'mouse'};x.down(edge,start);x.move(edge,{...start,clientY:start.clientY-8});
 A.equal(x.doc.querySelector('.day-time-feedback')?.textContent,'22:00–00:50 · 次日结束');x.up(edge,{...start,clientY:start.clientY-8});await x.settle();
 A.deepEqual(x.requests[0].props,{'计划开始时间':{date:DAY+'T22:00:00Z'},'计划截止时间':{date:'2026-10-20T00:50:00Z'}});
});

for(const mode of ['body','resize'])test('Day touch '+mode+' vibrates only at changed snap times and binds the capability once',async()=>{
 const pulses=[];let reads=0;const navigator={get vibrate(){reads++;return function(duration){A.strictEqual(this,navigator);pulses.push(duration);return true;};}};
 const x=await sheet('a',false,[],null,{navigator}),card=x.card('a'),target=mode==='resize'?grip(card,'[data-resize="end"]'):card,start=center(card);
 x.down(target,start);for(const dy of [9,10,11,13,14,15])x.move(target,{...start,clientY:start.clientY+dy});x.up(target,{...start,clientY:start.clientY+15});await x.settle();
 A.equal(reads,1);A.deepEqual(pulses,[7,7]);A.equal(x.requests.length,1);
 const mouse=x.card('a'),mouseStart={...center(mouse),pointerType:'mouse'};x.down(mouse,mouseStart);x.move(mouse,{...mouseStart,clientY:mouseStart.clientY+48});x.up(mouse,{...mouseStart,clientY:mouseStart.clientY+48});await x.settle();A.deepEqual(pulses,[7,7]);A.equal(reads,1);
});

test('Day disables a throwing vibration capability silently while retaining touch scheduling',async()=>{
 let calls=0;const x=await sheet('a',false,[],null,{navigator:{vibrate(){calls++;throw Error('unsupported vibration');}}}),card=x.card('a'),start=center(card);
 x.down(card,start);x.move(card,{...start,clientY:start.clientY+16});x.move(card,{...start,clientY:start.clientY+32});x.up(card,{...start,clientY:start.clientY+32});await x.settle();
 A.equal(calls,1);A.equal(x.requests.length,1);A.equal(x.messages.some(message=>message.includes('vibration')),false);
});

test('Day coverflow follows fractional movement and settles over frames without replacing the timeline or editor',async()=>{
 const x=await sheet('a',false,[todo('p'),todo('q'),todo('r')]),editor=x.editor,host=x.root.querySelector('[data-day-editor-host]'),scroll=x.root.querySelector('.day-main-pane .day-timeline-scroll'),timelineCard=x.card('a');scroll.scrollTop=512;
 const card=x.root.querySelector('.day-flow-card.is-front');x.down(card,{clientX:195,clientY:125});x.move(card,{clientX:165,clientY:125});
 A.equal(Number(x.root.querySelector('.day-flow-card.is-front').style['--flow-offset']),-.25,'30 px motion advances one quarter of the mobile card spacing');
 x.move(card,{clientX:110,clientY:125});const offset=()=>Number(x.root.querySelector('.day-flow-card.is-front').style['--flow-offset']),released=offset();A.ok(released>0&&released<.5);
 x.up(card,{clientX:110,clientY:125});A.equal(offset(),released,'pointerup keeps the release geometry until animation advances');A.ok(x.frameCount>0);
 await x.frame();await x.frame();A.ok(offset()<released&&offset()>0,'the card passes through an intermediate settling position');await x.settle();
 A.equal(x.root.querySelector('.day-flow-card.is-front').dataset.dayParkId,'q');A.equal(offset(),0);A.strictEqual(x.editor,editor);A.strictEqual(x.root.querySelector('[data-day-editor-host]'),host);A.strictEqual(x.card('a'),timelineCard);A.strictEqual(x.root.querySelector('.day-main-pane .day-timeline-scroll'),scroll);A.equal(scroll.scrollTop,512);A.equal(x.requests.length,0);
 emit(x.api.element,'click',x.root.querySelector('[data-day-action="flow-prev"]'));await x.settle();A.equal(x.root.querySelector('.day-flow-card.is-front').dataset.dayParkId,'p');A.strictEqual(x.editor,editor);
});

test('Day coverflow can travel through a complete cycle during one gesture and cancel back to its original card',async()=>{
 const x=await sheet('a',false,[todo('p'),todo('q'),todo('r')]),editor=x.editor,card=x.root.querySelector('.day-flow-card.is-front');
 x.down(card,{clientX:195,clientY:125});x.move(card,{clientX:-285,clientY:125});
 A.equal(x.root.querySelector('.day-flow-card.is-front').dataset.dayParkId,'q');A.equal(Number(x.root.querySelector('.day-flow-card.is-front').style['--flow-offset']),0);
 x.cancel(card,{clientX:-285,clientY:125});await x.settle();A.equal(x.root.querySelector('.day-flow-card.is-front').dataset.dayParkId,'p');A.strictEqual(x.editor,editor);A.equal(x.requests.length,0);
});

test('Day coverflow reduced-motion settling completes immediately without a detail repaint',async()=>{
 const x=await sheet('a',false,[todo('p'),todo('q'),todo('r')],null,{reducedMotion:true}),editor=x.editor,card=x.root.querySelector('.day-flow-card.is-front');
 x.down(card,{clientX:195,clientY:125});x.move(card,{clientX:110,clientY:125});x.up(card,{clientX:110,clientY:125});
 A.equal(x.root.querySelector('.day-flow-card.is-front').dataset.dayParkId,'q');A.equal(Number(x.root.querySelector('.day-flow-card.is-front').style['--flow-offset']),0);A.equal(x.frameCount,0);A.strictEqual(x.editor,editor);
});
