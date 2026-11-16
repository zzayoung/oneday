'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../../src/lite/core.js');
const ui=fs.readFileSync(path.join(__dirname,'../../src/lite/ui.js'),'utf8');
const themes=fs.readFileSync(path.join(__dirname,'../../src/lite/themes.js'),'utf8');

// Browser storage and the few DOM fields used by the real UI/theme modules.
function storage(){
 const rows=new Map();
 return {
  rows,failWrites:false,
  get length(){return rows.size;},
  key:i=>[...rows.keys()][i]??null,
  getItem:key=>rows.get(key)??null,
  setItem(key,value){if(this.failWrites)throw Error('QuotaExceededError');rows.set(key,String(value));},
  removeItem:key=>rows.delete(key)
 };
}
function setup(flags={},localStorage=storage(),onTheme){
 const elements=Object.fromEntries(['syncLabel','syncButton','connectionNotice','environmentLabel','toastRoot'].map(id=>[id,{textContent:'',innerHTML:'',hidden:true,className:'',title:''}]));
 const timers=new Map(),network=[];let timerId=0;
 const setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;};
 const clearTimeout=id=>timers.delete(id);
 const window={OneDayLiteCore:C,...flags,setTimeout,clearTimeout};
 const dataset={};
 if(onTheme)Object.defineProperty(dataset,'theme',{set(value){onTheme(window.OneDayLite,value);},get(){return 'glass-day';}});
 const document={documentElement:{dataset},getElementById:id=>elements[id],querySelector:()=>null,querySelectorAll:()=>[]};
 const fetch=(...args)=>{network.push(args);throw Error('Unexpected network call');};
 window.fetch=fetch;
 const context=vm.createContext({window,document,localStorage,setTimeout,clearTimeout,fetch});
 vm.runInContext(themes,context,{filename:'themes.js'});
 vm.runInContext(ui,context,{filename:'ui.js'});
 const L=window.OneDayLite;
 return {L,window,elements,localStorage,timers,network,runTimers(){for(const [id,{fn}]of [...timers]){timers.delete(id);fn();}}};
}
function connected(L,extra={}){
 L.store={state:{connected:true,loaded:true,pending:0,lastRead:'2026-10-19T00:00:00Z',lastWrite:null,readError:'',writeError:'',...extra}};
}

test('explicit account scopes isolate draft writes and override local mode',()=>{
 const disk=storage();
 const a=setup({__ONEDAY_SCOPE__:'sites:user-a',__ONEDAY_LOCAL__:true},disk).L;
 const b=setup({__ONEDAY_SCOPE__:'sites:user-b'},disk).L;
 A.equal(a.scope,'sites:user-a');A.equal(b.scope,'sites:user-b');
 a.save('draft.task.t',{title:'A 的草稿'});
 A.equal(b.read('draft.task.t'),null);
 b.save('draft.task.t',{title:'B 的草稿'});
 A.equal(a.read('draft.task.t').title,'A 的草稿');
 A.equal(b.read('draft.task.t').title,'B 的草稿');
 A.ok(disk.rows.has('oneday.lite.v1.sites:user-a.draft.task.t'));
});

test('legacy local and WorkBuddy scopes remain separate',()=>{
 const disk=storage(),local=setup({__ONEDAY_LOCAL__:true},disk).L,host=setup({},disk).L;
 A.equal(local.scope,'local');A.equal(host.scope,'workbuddy');
 local.save('capture.task','本机输入');
 A.equal(host.read('capture.task'),null);
});

test('draft export includes new-note drafts and only the active scope',()=>{
 const disk=storage(),a=setup({__ONEDAY_SCOPE__:'sites:a'},disk).L,b=setup({__ONEDAY_SCOPE__:'sites:b'},disk).L;
 const keys=['draft.task.t','capture.task','newtask.root','newnote.root','worklog.t','repair.t'];
 for(const key of keys)a.save(key,{body:key});
 a.save('preference.example','retained');b.save('newnote.other',{body:'other account'});
 A.deepEqual(Object.keys(a.listDrafts()).sort(),keys.sort());
 A.equal(a.listDrafts()['newnote.root'].body,'newnote.root');
});

test('clearing active drafts removes new-note drafts and preserves other scopes and preferences',()=>{
 const disk=storage(),a=setup({__ONEDAY_SCOPE__:'sites:a'},disk).L,b=setup({__ONEDAY_SCOPE__:'sites:b'},disk).L;
 a.save('newnote.root',{body:'remove me'});a.save('draft.task.t',{title:'remove me'});
 a.save('view','board');b.save('newnote.root',{body:'keep me'});
 a.clearDrafts();
 A.equal(a.read('newnote.root'),null);A.equal(a.read('draft.task.t'),null);
 A.equal(a.read('view'),'board');A.equal(b.read('newnote.root').body,'keep me');
});

test('draft registry is available before theme application',()=>{
 let registered=false,flushed=false;
 const {L}=setup({},storage(),L=>{
  A.equal(typeof L.registerDraftSource,'function');
  L.registerDraftSource({flushLocal(){flushed=true;},isDirty:()=>false});registered=true;
 });
 A.equal(registered,true);A.equal(L.flushDrafts(),true);A.equal(flushed,true);
});

test('flush captures every registered source immediately without scheduling or network work',()=>{
 const {L,localStorage,timers,network}=setup(),visited=[];
 L.store={read(){network.push('read');},patch(){network.push('patch');}};
 const one={flushLocal(){visited.push(['one',L.capturingDrafts]);return L.save('draft.task.t',{title:'latest'});},isDirty:()=>true};
 const unregister=L.registerDraftSource(one);
 L.registerDraftSource(one);
 L.registerDraftSource({flushLocal(){visited.push(['two',L.capturingDrafts]);L.save('newnote.root',{body:'latest note'});},isDirty:()=>true});
 const result=L.flushDrafts();
 A.equal(typeof result,'boolean');A.equal(result,true);
 A.deepEqual(visited,[['one',true],['two',true]]);
 A.equal(L.read('draft.task.t').title,'latest');A.equal(L.read('newnote.root').body,'latest note');
 A.ok(localStorage.rows.has('oneday.lite.v1.workbuddy.newnote.root'));
 A.equal(L.capturingDrafts,false);A.equal(timers.size,0);A.deepEqual(network,[]);
 unregister();unregister();visited.length=0;
 A.equal(L.flushDrafts(),true);A.deepEqual(visited,[['two',true]]);
});

test('an empty registry has no dirty changes and flushes successfully',()=>{
 const {L}=setup();A.equal(typeof L.flushDrafts(),'boolean');
 A.equal(L.flushDrafts(),true);A.equal(L.hasUnsavedChanges(),false);
});

test('source failure is reported while other sources are still captured',()=>{
 const {L}=setup(),visited=[];
 L.registerDraftSource({flushLocal(){visited.push('false');return false;},isDirty:()=>true});
 L.registerDraftSource({flushLocal(){visited.push('throws');throw Error('detached editor');},isDirty:()=>true});
 L.registerDraftSource({flushLocal(){visited.push('last');L.save('capture.note','retained');},isDirty:()=>false});
 A.equal(L.flushDrafts(),false);A.deepEqual(visited,['false','throws','last']);
 A.equal(L.read('capture.note'),'retained');A.equal(L.capturingDrafts,false);
 A.equal(L.hasUnsavedChanges(),true);
});

test('flush restores a pre-existing capture flag even when a source throws',()=>{
 const {L}=setup();L.capturingDrafts=true;
 L.registerDraftSource({flushLocal(){throw Error('editor failed');},isDirty:()=>true});
 A.equal(L.flushDrafts(),false);A.equal(L.capturingDrafts,true);
});

test('ignored local-storage failures make flush fail without losing the prior draft or dirty state',()=>{
 const {L,localStorage,timers,elements,runTimers}=setup();
 L.save('draft.task.t',{title:'last persisted'});
 L.registerDraftSource({flushLocal(){L.save('draft.task.t',{title:'still in editor'});},isDirty:()=>true});
 localStorage.failWrites=true;
 A.equal(L.flushDrafts(),false);A.equal(L.flushDrafts(),false);
 A.equal(L.read('draft.task.t').title,'last persisted');A.equal(L.hasUnsavedChanges(),true);
 A.equal(L.capturingDrafts,false);A.equal(L.draftStorageAvailable,false);
 A.equal([...timers.values()].filter(t=>t.ms===10).length,1);
 runTimers();A.match(elements.toastRoot.innerHTML,/草稿无法跨刷新保留/);
 localStorage.failWrites=false;
 A.equal(L.flushDrafts(),true);A.equal(L.draftStorageAvailable,true);
 A.equal(L.read('draft.task.t').title,'still in editor');
 const descriptor=Object.getOwnPropertyDescriptor(L,'draftStorageAvailable');
 A.equal(typeof descriptor.get,'function');A.equal(descriptor.set,undefined);
});

test('a later successful save cannot conceal an earlier failure in the same flush',()=>{
 const {L,localStorage}=setup();
 L.registerDraftSource({flushLocal(){localStorage.failWrites=true;L.save('draft.task.t','unwritten');},isDirty:()=>true});
 L.registerDraftSource({flushLocal(){localStorage.failWrites=false;return L.save('newnote.root','written');},isDirty:()=>true});
 A.equal(L.flushDrafts(),false);A.equal(L.read('draft.task.t'),null);
 A.equal(L.read('newnote.root'),'written');A.equal(L.capturingDrafts,false);
});

test('dirty detection is synchronous and conservatively retains sources that throw',()=>{
 const {L,timers,network}=setup();let flushes=0,dirty=false;
 L.registerDraftSource({flushLocal(){flushes++;},isDirty:()=>dirty});
 A.equal(L.hasUnsavedChanges(),false);dirty=true;A.equal(L.hasUnsavedChanges(),true);
 dirty=false;
 const unregister=L.registerDraftSource({flushLocal(){flushes++;},isDirty(){throw Error('cannot inspect editor');}});
 A.equal(L.hasUnsavedChanges(),true);unregister();A.equal(L.hasUnsavedChanges(),false);
 A.equal(flushes,0);A.equal(timers.size,0);A.deepEqual(network,[]);
});

test('Sites status distinguishes connection from a confirmed cloud save',()=>{
 const {L,elements}=setup({__ONEDAY_SITES__:true});connected(L);
 L.paintSync();A.equal(elements.syncLabel.textContent,'已连接云端');
 A.equal(elements.environmentLabel.textContent,'私人空间 · 云端同步');
 L.store.state.lastWrite='2026-10-19T00:01:00Z';L.paintSync();
 A.equal(elements.syncLabel.textContent,'云端已保存');A.equal(elements.connectionNotice.hidden,true);
});

test('Sites pending and error states retain their current notice and last-good-data message',()=>{
 const {L,elements}=setup({__ONEDAY_SITES__:true});connected(L,{pending:1});
 L.paintSync();A.equal(elements.syncLabel.textContent,'保存中');A.match(elements.syncButton.className,/saving/);
 L.store.state.writeError='保存失败 <unsafe>';L.paintSync();
 A.equal(elements.syncLabel.textContent,'需检查');A.match(elements.syncButton.className,/error/);
 A.equal(elements.connectionNotice.hidden,false);
 A.match(elements.connectionNotice.innerHTML,/保留上次成功读取的数据/);
 A.match(elements.connectionNotice.innerHTML,/&lt;unsafe&gt;/);
 A.match(elements.connectionNotice.innerHTML,/<button data-act="refresh">重读<\/button>/);
});

test('Sites authentication failures expose a normal top-level ChatGPT sign-in link',()=>{
 const cases=[{authRequired:true},{status:401},{readStatus:401},{writeStatus:401},{readError:'HTTP 401 Unauthorized'},{writeError:'请登录后继续'},{readError:'网络不可用',writeError:'HTTP 401'}];
 for(const state of cases){
  const {L,elements,network}=setup({__ONEDAY_SITES__:true});connected(L,state);L.paintSync();
  A.equal(elements.connectionNotice.hidden,false,JSON.stringify(state));
  A.match(elements.connectionNotice.innerHTML,/<a\b[^>]*href="\/signin-with-chatgpt\?return_to=\/"[^>]*target="_top"[^>]*>登录 ChatGPT<\/a>/,JSON.stringify(state));
  A.deepEqual(network,[]);
 }
});

test('the cloud SDK authentication flag shows sign-in and clears after a successful request',()=>{
 const {L,window,elements}=setup({__ONEDAY_SITES__:true,__ONEDAY_AUTH_REQUIRED__:true});connected(L);
 L.paintSync();A.equal(elements.connectionNotice.hidden,false);
 A.match(elements.connectionNotice.innerHTML,/href="\/signin-with-chatgpt\?return_to=\/" target="_top"/);
 window.__ONEDAY_AUTH_REQUIRED__=false;L.paintSync();
 A.equal(elements.connectionNotice.hidden,true);A.equal(elements.syncLabel.textContent,'已连接云端');
});

test('ordinary Sites failures do not invent an authentication error',()=>{
 const {L,elements}=setup({__ONEDAY_SITES__:true});connected(L,{writeError:'保存失败 14012',status:403});L.paintSync();
 A.equal(elements.connectionNotice.hidden,false);A.doesNotMatch(elements.connectionNotice.innerHTML,/signin-with-chatgpt/);
});

test('local and WorkBuddy sync labels preserve existing behavior',()=>{
 const local=setup({__ONEDAY_LOCAL__:true});connected(local.L);local.L.paintSync();
 A.equal(local.elements.syncLabel.textContent,'本机已保存');
 A.equal(local.elements.environmentLabel.textContent,'本机体验 · 不跨设备同步');
 const host=setup();connected(host.L);host.L.paintSync();A.equal(host.elements.syncLabel.textContent,'已读取');
 host.L.store.state.lastWrite='2026-10-19T00:01:00Z';host.L.paintSync();A.equal(host.elements.syncLabel.textContent,'已保存');
});
