'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');
const decode=value=>String(value).replace(/&(?:amp|quot|#39|lt|gt);/g,entity=>({'&amp;':'&','&quot;':'"','&#39;':"'",'&lt;':'<','&gt;':'>'}[entity]));
const camel=value=>value.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());

// The production dialog, editor, draft registry, and event handlers run together.
// This DOM boundary records focus attempts, including rejected inert/disconnected
// targets; mobile keyboard presentation and CSS geometry require native QA.
class Element{
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.nodeType=1;this.childNodes=[];this.attrs={};this.dataset={};this.style={};this.listeners={};this.value='';
  this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle:(name,on)=>{on??=!this.classList.contains(name);this.classList[on?'add':'remove'](name);return on;}};
 }
 get children(){return this.childNodes.filter(node=>node.nodeType===1);}
 get className(){return this.attrs.class||'';}set className(value){this.attrs.class=String(value);}
 get id(){return this.attrs.id||'';}set id(value){this.attrs.id=String(value);}
 get inert(){return this.attrs.inert!==undefined;}set inert(value){if(value)this.attrs.inert='';else delete this.attrs.inert;}
 get hidden(){return this.attrs.hidden!==undefined;}set hidden(value){if(value)this.attrs.hidden='';else delete this.attrs.hidden;}
 get disabled(){return this.attrs.disabled!==undefined;}set disabled(value){if(value)this.attrs.disabled='';else delete this.attrs.disabled;}
 get isConnected(){return !!this._connected||!!this.parentElement?.isConnected;}
 get textContent(){return this.childNodes.map(node=>node.textContent).join('');}set textContent(value){this.clear();this.append(textNode(String(value)));}
 get innerHTML(){return this.childNodes.map(node=>node.nodeType===3?node.nodeValue:'<'+node.tagName.toLowerCase()+Object.entries(node.attrs).map(([key,value])=>' '+key+'="'+value+'"').join('')+'>'+(/^(BR|INPUT|HR|IMG)$/.test(node.tagName)?'':node.innerHTML+'</'+node.tagName.toLowerCase()+'>')).join('');}
 set innerHTML(value){this.clear();parse(this,String(value));}
 clear(){for(const node of this.childNodes)node.parentElement=node.parentNode=null;this.childNodes=[];}
 append(...nodes){for(const node of nodes){node.remove?.();node.parentElement=node.parentNode=this;this.childNodes.push(node);}}
 remove(){if(this.parentElement){this.parentElement.childNodes=this.parentElement.childNodes.filter(node=>node!==this);this.parentElement=this.parentNode=null;}}
 setAttribute(name,value){this.attrs[name]=String(value);if(name.startsWith('data-'))this.dataset[camel(name.slice(5))]=String(value);if(name==='value')this.value=String(value);}
 getAttribute(name){return this.attrs[name]??null;}
 matches(selector){return selector.split(',').some(part=>match(this,part.trim().split(/\s+/)));}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches?.(selector))return node;return null;}
 querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 contains(node){for(;node;node=node.parentElement)if(node===this)return true;return false;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 focus(){const doc=this.ownerDocument;doc.focusAttempts.push({element:this,activation:doc.activation});if(this.isConnected&&!this.closest('[inert],[hidden]')&&!this.disabled)doc.activeElement=this;}
}
function textNode(value){return {nodeType:3,nodeValue:value,get textContent(){return this.nodeValue;}};}
function simple(node,selector){
 const excluded=[...selector.matchAll(/:not\(([^)]+)\)/g)];if(excluded.some(item=>simple(node,item[1])))return false;
 selector=selector.replace(/:not\([^)]+\)/g,'');
 for(const attr of selector.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']*)["']?)?\]/g)){const value=node.getAttribute(attr[1]);if(value===null||(attr[2]!==undefined&&value!==attr[2]))return false;}
 const rest=selector.replace(/\[[^\]]+\]/g,''),tag=rest.match(/^[a-z][\w-]*/i)?.[0];if(tag&&node.tagName!==tag.toUpperCase())return false;
 for(const item of rest.matchAll(/([.#])([\w-]+)/g))if(item[1]==='.'?!node.classList.contains(item[2]):node.id!==item[2])return false;
 return !!selector&&!rest.includes(':');
}
function match(node,parts){let index=parts.length-1;if(!simple(node,parts[index]))return false;for(index--;index>=0;index--){do{node=node.parentElement;}while(node&&!simple(node,parts[index]));if(!node)return false;}return true;}
function parse(root,html){
 const stack=[root],voids=new Set(['input','img','br','hr','meta','link']);
 for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
  if(token.startsWith('</')){const tag=token.slice(2,-1).trim().toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break;}continue;}
  if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const node=new Element(tag,root.ownerDocument);
   for(const attr of token.slice(tag.length+1).replace(/\/?>$/,'').matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(attr[1],decode(attr[2]??attr[3]??attr[4]??''));
   stack.at(-1).append(node);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1).append(textNode(decode(token)));
 }
}
function setup(notes=[]){
 const disk=new Map(),timers=new Map();let seq=0;
 const doc={focusAttempts:[],activation:false};doc.documentElement=new Element('html',doc);doc.documentElement._connected=true;doc.body=new Element('body',doc);doc.documentElement.append(doc.body);doc.activeElement=doc.body;
 doc.createElement=tag=>new Element(tag,doc);doc.querySelector=selector=>doc.documentElement.querySelector(selector);doc.querySelectorAll=selector=>doc.documentElement.querySelectorAll(selector);doc.getElementById=id=>doc.querySelector('#'+id);
 for(const id of ['app','modalRoot','toastRoot']){const node=doc.createElement('div');node.id=id;doc.body.append(node);}
 const context={console,document:doc,Node:{TEXT_NODE:3,ELEMENT_NODE:1},setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),localStorage:{get length(){return disk.size;},key:index=>[...disk.keys()][index]??null,getItem:key=>disk.get(key)??null,setItem:(key,value)=>disk.set(key,String(value)),removeItem:key=>disk.delete(key)}};
 context.window=context;vm.createContext(context);
 for(const file of ['src/core.js','src/lite/core.js','src/lite/themes.js','src/lite/ui.js','src/lite/dialogs.js','src/lite/editor.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 const L=context.OneDayLite;L.store={data:{tasks:[],notes,logs:[],tags:[],links:[]}};
 function emit(target,type){const event={type,target,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;}};for(let node=target;node;node=node.parentElement){event.currentTarget=node;node['on'+type]?.(event);for(const fn of node.listeners[type]||[])fn(event);if(event.propagationStopped)break;}return event;}
 return {L,doc,timers,emit,click(target){doc.activation=true;try{return emit(target,'click');}finally{doc.activation=false;}},runFocusTimers(){for(const[id,{fn,ms}]of [...timers])if(ms===50){timers.delete(id);fn();}},type(dialog,value){const surface=dialog.q('[data-live-md]');surface.textContent=value;emit(surface,'input');}};
}

test('creation editor receives focus in the activation handler and keeps it after modal fallback',()=>{
 const x=setup(),launcher=x.doc.createElement('button');x.doc.getElementById('app').append(launcher);let dialog;
 launcher.addEventListener('click',()=>{dialog=x.L.openCreationSheet();});launcher.focus();x.click(launcher);
 const surface=dialog.q('[data-live-md]');A.equal(x.doc.activeElement===surface,true,'the editor is focused before activation returns');
 A.equal(x.doc.focusAttempts.find(attempt=>attempt.element===surface)?.activation,true);
 x.runFocusTimers();A.equal(x.doc.activeElement===surface,true,'fallback preserves editor focus');
});

test('a parent fallback never attempts focus while its nested dialog is active',()=>{
 const x=setup();let child;
 const parent=x.L.dialog({title:'父层',body:'<input id="parentInput" autofocus>',onMount:()=>{child=x.L.dialog({title:'子层',body:'<input id="childInput" autofocus>'});}});
 A.equal(parent.element.inert,true);x.runFocusTimers();A.equal(x.doc.activeElement===child.q('#childInput'),true);
 A.equal(x.doc.focusAttempts.some(attempt=>parent.element.contains(attempt.element)),false);
});

test('closing before fallback cannot refocus the detached modal',async()=>{
 const x=setup(),launcher=x.doc.createElement('button');x.doc.getElementById('app').append(launcher);launcher.focus();
 const dialog=x.L.dialog({title:'短暂对话框',body:'<input autofocus>'});await dialog.close();x.runFocusTimers();
 A.equal(x.doc.activeElement===launcher,true);A.equal(x.doc.focusAttempts.some(attempt=>dialog.element.contains(attempt.element)),false);
});

test('ordinary dialog fallback retains explicit autofocus and default close focus',()=>{
 const x=setup(),first=x.L.dialog({title:'选项',body:'<input id="choice" autofocus>'});x.runFocusTimers();A.equal(x.doc.activeElement===first.q('#choice'),true);
 const second=x.L.dialog({title:'提示',body:'<p>消息</p>'});x.runFocusTimers();A.equal(x.doc.activeElement===second.q('.modal-close'),true);
});

test('creation exposes only four category buttons and preserves existing custom notes',()=>{
 const notes=[{_id:'custom','便签分类':'自定义资料','便签内容':'保留原记录'}],x=setup(notes),dialog=x.L.openCreationSheet();
 const buttons=dialog.qa('[data-record-category]');A.deepEqual(Array.from(buttons,button=>button.textContent),['待办','灵感','记录','引用']);
 x.type(dialog,'分类测试');x.click(buttons[1]);A.equal(x.L.read('newrecord.root').category,'灵感');A.equal(dialog.q('#newRecordDuration').hidden,true);
 x.click(buttons[0]);A.equal(dialog.q('#newRecordDuration').hidden,false);A.equal(buttons[0].getAttribute('aria-pressed'),'true');A.equal(buttons[1].getAttribute('aria-pressed'),'false');
 A.deepEqual(notes,[{_id:'custom','便签分类':'自定义资料','便签内容':'保留原记录'}]);
});

test('duration is the sole creation range and keeps its bounds, default and draft updates',()=>{
 const x=setup(),dialog=x.L.openCreationSheet(),duration=dialog.q('#newTaskDuration');
 A.deepEqual(Array.from(dialog.qa('input[type="range"]'),node=>node.id),['newTaskDuration']);A.equal(duration.value,'60');
 A.equal(duration.getAttribute('min'),'10');A.equal(duration.getAttribute('max'),'480');A.equal(duration.getAttribute('step'),'10');
 x.type(dialog,'安排时间');for(const minutes of ['10','480']){duration.value=minutes;x.emit(duration,'input');A.equal(x.L.read('newrecord.root').estimate,Number(minutes));A.equal(duration.getAttribute('aria-valuetext'),dialog.q('#newTaskDurationLabel').textContent);}
 A.equal(dialog.q('#newTaskSave').textContent,'添加');
});

test('child creation ignores category clicks outside 待办 and keeps its own draft',()=>{
 const x=setup(),dialog=x.L.openCreationSheet({parent:'parent-task'}),buttons=dialog.qa('[data-record-category]');x.type(dialog,'子任务');
 for(const button of buttons.slice(1)){A.equal(button.disabled,true);x.click(button);}
 A.equal(x.L.read('newrecord.parent-task').category,'待办');A.equal(x.L.read('newrecord.parent-task').parent,'parent-task');A.equal(x.L.read('newrecord.root'),null);
});
