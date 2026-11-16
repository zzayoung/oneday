const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');

function setup(){
 const timers=new Map(),drafts=new Map(),sources=new Set();let seq=0,write=async()=>{};
 const row={_id:'t1','任务标题':'原始标题','任务详情':'原始正文'};
 const context={console,setTimeout:fn=>{const id=++seq;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
 context.window=context;vm.createContext(context);
 for(const file of ['src/core.js','src/lite/core.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 const L=context.OneDayLite={C:context.OneDayLiteCore,UI:{},icon:()=>'',read:(key,fallback=null)=>drafts.has(key)?drafts.get(key):fallback,save:(key,value)=>{drafts.set(key,structuredClone(value));return true;},remove:key=>drafts.delete(key),registerDraftSource:source=>{sources.add(source);return()=>sources.delete(source);},store:{data:{tasks:[row],notes:[],logs:[],tags:[],links:[]},get:()=>row,patch:async(_table,_id,props)=>{await write(props);for(const[key,value]of Object.entries(props))row[key]=L.C.value(value);return {...row};}}};
 vm.runInContext(fs.readFileSync(path.join(ROOT,'src/lite/dialogs.js'),'utf8'),context,{filename:'src/lite/dialogs.js'});
 return {L,row,drafts,sources,timers,context,setWrite:fn=>write=fn,create:()=>L.draftSession('tasks','t1',{'任务标题':row['任务标题'],'任务详情':row['任务详情']})};
}
function sheetHost(x){
 const fields=new Map(),editors=[],events=new Map(),notices=[];let close,closed=false;
 const node=()=>({value:'',dataset:{},listeners:new Map(),classList:{add(){},toggle(){}},addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);},setAttribute(){},querySelectorAll:()=>[],focus(){}});
 const d={q:selector=>{if(!fields.has(selector))fields.set(selector,node());return fields.get(selector);},qa:()=>[],on(selector,event,fn){events.set(selector+':'+event,fn);},close:async(force=false)=>{if(!force&&close&&await close()===false)return false;closed=true;return true;},root:node(),element:node()};
 x.L.dateText=()=>'';x.L.toast=(message,action)=>notices.push({message,action});x.L.confirm=async()=>true;x.L.run=async fn=>fn();
 x.L.dialog=options=>{close=options.onClose;options.onMount(d);return d;};
 x.context.OneDayLiteEditor={mount:(_root,options)=>{const editor={value:options.value,destroyed:false,getValue(){return this.value;},setValue(value){this.value=value;},setReadOnly(){},flush(){},whenReady:async()=>{},destroy(){this.destroyed=true;},focus(){},type(value){this.value=value;options.onChange(value);}};editors.push(editor);return editor;}};
 return {d,editors,events,notices,get closed(){return closed;},close:()=>d.close(),category(index){const button={dataset:{recordCategory:String(index)},disabled:false,closest:selector=>selector==='[data-record-category]'?button:null};for(const fn of d.element.listeners.get('click')||[])fn({target:button});},submit:()=>events.get('#newTaskSave:click')()};
}

test('dirty session is registered for synchronous lifecycle capture without network writes',()=>{
 const x=setup(),session=x.create();let writes=0;x.setWrite(()=>writes++);
 A.equal(x.sources.size,1);session.change('任务详情','离开页面前的新正文');
 x.L.capturingDrafts=true;for(const source of x.sources)source.flushLocal();x.L.capturingDrafts=false;
 A.equal(writes,0);A.equal(x.timers.size,0);A.equal(x.drafts.get('draft.tasks.t1').fields['任务详情'],'离开页面前的新正文');
 A.equal([...x.sources][0].isDirty(),true);session.dispose();A.equal(x.sources.size,0);
});

test('failed save survives disposal and returns as a restorable local draft',async()=>{
 const x=setup(),session=x.create();x.setWrite(async()=>{throw Error('offline');});
 session.change('任务详情','不能丢掉的正文');await A.rejects(session.flush(),/offline/);session.dispose();
 const recovered=x.create();A.equal(recovered.draft.fields['任务详情'],'不能丢掉的正文');
 x.setWrite(async()=>{});recovered.restore();await recovered.flush();
 A.equal(x.row['任务详情'],'不能丢掉的正文');A.equal(x.drafts.has('draft.tasks.t1'),false);recovered.dispose();
});

test('reverting to original text during an in-flight save is persisted after its acknowledgement',async()=>{
 const x=setup(),session=x.create();let finish,first=true;
 x.setWrite(()=>first?(first=false,new Promise(resolve=>finish=resolve)):Promise.resolve());
 session.change('任务详情','临时文字');const saving=session.flush();
 session.change('任务详情','原始正文');finish();await saving;
 A.equal(x.row['任务详情'],'原始正文');A.equal(session.dirty,false);A.equal(x.drafts.has('draft.tasks.t1'),false);session.dispose();
});

test('a refresh during an in-flight write cannot overwrite a newer local reversion',async()=>{
 const x=setup(),session=x.create();let finish,first=true;
 x.setWrite(()=>first?(first=false,new Promise(resolve=>finish=resolve)):Promise.resolve());
 session.change('任务详情','第一次提交');const saving=session.flush();session.change('任务详情','原始正文');
 session.sync({...x.row,'任务详情':'第一次提交'});const visible=session.values['任务详情'];finish();await saving;
 A.equal(visible,'原始正文');A.equal(x.row['任务详情'],'原始正文');session.dispose();
});

test('a local reversion remains recoverable when its earlier in-flight write fails',async()=>{
 const x=setup(),session=x.create();let fail;
 x.setWrite(()=>new Promise((_resolve,reject)=>fail=reject));
 session.change('任务详情','未确认的提交');const saving=session.flush();session.change('任务详情','原始正文');
 fail(Error('连接中断，无法确认提交'));await A.rejects(saving,/无法确认/);session.dispose();
 A.equal(x.drafts.get('draft.tasks.t1')?.fields['任务详情'],'原始正文');
});

test('lifecycle capture of a just-typed change does not schedule an autosave',()=>{
 const x=setup(),session=x.create();x.L.capturingDrafts=true;
 session.change('任务详情','后台切换时捕获');x.L.capturingDrafts=false;
 A.equal(x.timers.size,0);A.equal(x.drafts.get('draft.tasks.t1').fields['任务详情'],'后台切换时捕获');session.dispose();
});

test('record draft restores exact content and intentionally clearing it removes the draft',()=>{
 const x=setup();A.equal(typeof x.L.creationDraft,'function');
 x.drafts.set('newrecord.root',{body:'旧的正文',category:'记录'});
 const draft=x.L.creationDraft('newrecord.root',{body:'',category:'待办'});
 A.equal(draft.values.body,'旧的正文');draft.set({body:'',category:'记录'});
 A.equal(x.drafts.has('newrecord.root'),false);A.equal(draft.dirty,false);draft.dispose();
});

test('creation acknowledgement never deletes edits made while that submission was pending',()=>{
 const x=setup();A.equal(typeof x.L.creationDraft,'function');
 const draft=x.L.creationDraft('newrecord.root',{body:''});draft.set({body:'提交的正文'});
 const submitted=structuredClone(draft.values);draft.set({body:'请求期间的新正文'});
 A.equal(draft.acknowledge(submitted),false);A.equal(x.drafts.get('newrecord.root').body,'请求期间的新正文');draft.dispose();
});

test('successful creation clears only its confirmed record draft and keeps a separate subrecord draft',()=>{
 const x=setup();A.equal(typeof x.L.creationDraft,'function');
 const record=x.L.creationDraft('newrecord.root',{body:''}),subrecord=x.L.creationDraft('newrecord.t1',{body:''});
 record.set({body:'当前记录'});subrecord.set({body:'还没提交的子记录'});
 A.equal(record.acknowledge(structuredClone(record.values)),true);
 A.equal(x.drafts.has('newrecord.root'),false);A.equal(x.drafts.get('newrecord.t1').body,'还没提交的子记录');
 record.dispose();subrecord.dispose();A.equal(x.drafts.has('newrecord.root'),false);
});

test('a record with blank leading lines retains its exact nonempty Markdown draft',()=>{
 const x=setup(),draft=x.L.creationDraft('newrecord.root',{body:''});
 draft.set({body:'  \n\n正文不能丢'});
 A.equal(x.drafts.get('newrecord.root')?.body,'  \n\n正文不能丢');draft.dispose();
});

test('acknowledging an older tab leaves a newer draft from the same local namespace intact',()=>{
 const x=setup(),old=x.L.creationDraft('newrecord.root',{body:''});old.set({body:'旧提交'});
 const submitted=structuredClone(old.values),newer=x.L.creationDraft('newrecord.root',{body:''});newer.set({body:'另一个窗口的新草稿'});
 A.equal(old.acknowledge(submitted),false);old.dispose();A.equal(x.drafts.get('newrecord.root').body,'另一个窗口的新草稿');newer.dispose();
});

test('a note sheet stays open if neither the cloud nor local drafts can retain its text',async()=>{
 const x=setup(),host=sheetHost(x);x.L.openNote('t1');
 x.L.save=()=>false;x.setWrite(async()=>{throw Error('offline');});host.editors[0].type('仍然需要留在屏幕上的笔记');
 A.equal(await host.close(),false);
});

test('an unsubmitted creation sheet stays open if local draft storage fails',async()=>{
 const x=setup(),host=sheetHost(x);x.L.openCreationSheet();
 x.L.save=()=>false;host.editors[0].type('还没有提交的任务');
 A.equal(await host.close(),false);A.equal(host.closed,false);A.equal(host.editors[0].destroyed,false);
});

test('record submission waits for the shared editor attachment and saves its completed content',async()=>{
 const x=setup(),host=sheetHost(x),writes=[];let finish;
 x.L.store.createTask=async values=>{writes.push(values);return {_id:'created'};};x.L.openCreationSheet();
 A.equal(host.editors.length,1);const editor=host.editors[0];editor.type('提交记录');
 const attachment=new Promise(resolve=>finish=resolve);editor.whenReady=()=>attachment;
 const submitting=host.submit();await new Promise(setImmediate);
 A.equal(writes.length,0);A.equal(host.closed,false);A.equal(editor.destroyed,false);
 editor.type('提交记录\n[附件](https://example.test/a.pdf)');finish();await submitting;
 A.equal(writes.length,1);A.equal(writes[0].body,'提交记录\n[附件](https://example.test/a.pdf)');A.equal(host.closed,true);A.equal(editor.destroyed,true);A.equal(x.drafts.has('newrecord.root'),false);
});

test('closing an unsubmitted record waits for its attachment and retains the completed local draft',async()=>{
 const x=setup(),host=sheetHost(x);let finish;x.L.openCreationSheet();
 const editor=host.editors[0];editor.type('暂存资料');editor.whenReady=()=>new Promise(resolve=>finish=resolve);
 const closing=host.close();await new Promise(setImmediate);A.equal(host.closed,false);A.equal(editor.destroyed,false);
 editor.type('暂存资料\n[附件](https://example.test/a.pdf)');finish();await closing;
 A.equal(host.closed,true);A.equal(editor.destroyed,true);A.equal(x.drafts.get('newrecord.root').body,'暂存资料\n[附件](https://example.test/a.pdf)');
});

test('typing while a record save is pending remains in the shared draft and keeps the sheet open',async()=>{
 const x=setup(),host=sheetHost(x);let finish,submitted;
 x.L.store.createTask=values=>{submitted=values;return new Promise(resolve=>finish=resolve);};x.L.openCreationSheet();const editor=host.editors[0];editor.type('提交的记录');
 const submitting=host.submit();await new Promise(setImmediate);A.equal(submitted.body,'提交的记录');editor.type('保存期间补充的新正文');finish({_id:'created'});await submitting;
 A.equal(host.closed,false);A.equal(editor.destroyed,false);A.equal(editor.getValue(),'保存期间补充的新正文');A.equal(x.drafts.get('newrecord.root').body,'保存期间补充的新正文');
});

test('switching record categories keeps one editor buffer and submits the chosen category',async()=>{
 const x=setup(),host=sheetHost(x),writes=[];x.L.store.createNote=async(body,category)=>{writes.push({body,category});return {_id:'note'};};x.L.openCreationSheet();const editor=host.editors[0];editor.type('共享正文\n**保留格式**');
 host.category(1);A.equal(host.d.q('#newRecordDuration').hidden,true);A.equal(x.drafts.get('newrecord.root').category,'灵感');
 host.category(0);A.equal(host.d.q('#newRecordDuration').hidden,false);host.category(3);
 A.equal(host.editors.length,1);A.equal(host.editors[0],editor);A.equal(editor.getValue(),'共享正文\n**保留格式**');await host.submit();
 A.deepEqual(writes,[{body:'共享正文\n**保留格式**',category:'引用'}]);A.equal(host.closed,true);A.equal(x.drafts.has('newrecord.root'),false);
});

test('a successful submission cannot close newer text when its local persistence failed',async()=>{
 const x=setup(),host=sheetHost(x);let finish;
 x.L.store.createTask=()=>new Promise(resolve=>finish=resolve);x.L.openCreationSheet();const editor=host.editors[0];editor.type('已提交的记录');
 const submitting=host.submit();await new Promise(setImmediate);x.L.save=()=>false;editor.type('尚未提交也无法保存的新正文');finish({_id:'created'});await submitting;
 A.equal(host.closed,false);A.equal(editor.destroyed,false);A.equal(editor.getValue(),'尚未提交也无法保存的新正文');A.equal(await host.close(),false);A.equal(host.closed,false);
});

test('saving one migrated legacy draft preserves the other independent legacy draft',async()=>{
 const x=setup(),host=sheetHost(x),legacyNote={body:'另一份尚未提交的笔记',category:'灵感'};
 x.drafts.set('newtask.root',{title:'旧任务',body:'旧任务正文',estimate:70});x.drafts.set('newnote.root',legacyNote);
 let submitted;x.L.store.createTask=async values=>{submitted=values;return {_id:'created'};};x.L.openCreationSheet();
 A.equal(host.editors[0].getValue(),'旧任务\n\n旧任务正文');await host.submit();
 A.equal(submitted.body,'旧任务\n\n旧任务正文');A.equal(x.drafts.has('newtask.root'),false);A.deepEqual(x.drafts.get('newnote.root'),legacyNote);
});

test('a migrated legacy draft is consumed after closing, reopening and successfully adding it',async()=>{
 const x=setup();x.drafts.set('newtask.root',{title:'旧任务',body:'旧正文',estimate:70});
 const first=sheetHost(x);x.L.openCreationSheet();A.equal(first.editors[0].getValue(),'旧任务\n\n旧正文');await first.close();
 const reopened=sheetHost(x);x.L.store.createTask=async()=>({_id:'created'});x.L.openCreationSheet();A.equal(reopened.editors[0].getValue(),'旧任务\n\n旧正文');await reopened.submit();
 A.equal(x.drafts.has('newrecord.root'),false);A.equal(x.drafts.has('newtask.root'),false);
 const fresh=sheetHost(x);x.L.openCreationSheet();A.equal(fresh.editors[0].getValue(),'');
});

test('clearing an imported legacy draft before the first edit does not resurrect it on reopen',async()=>{
 const x=setup();x.drafts.set('newtask.root',{title:'不要的旧草稿',body:'旧正文'});
 const first=sheetHost(x);x.L.openCreationSheet();first.editors[0].type('');await first.close();
 const reopened=sheetHost(x);x.L.openCreationSheet();A.equal(reopened.editors[0].getValue(),'');
});

test('subrecord creation does not consume or display unrelated global legacy drafts',async()=>{
 const x=setup(),host=sheetHost(x),taskDraft={title:'全局任务草稿',body:'根级正文'},noteDraft={body:'全局笔记草稿',category:'记录'};
 x.drafts.set('newtask.root',taskDraft);x.drafts.set('newnote.root',noteDraft);let submitted;
 x.L.store.createTask=async values=>{submitted=values;return {_id:'child'};};x.L.openCreationSheet({parent:'t1'});
 A.equal(host.editors[0].getValue(),'');host.editors[0].type('独立的子记录');await host.submit();
 A.equal(submitted.parent,'t1');A.equal(submitted.body,'独立的子记录');A.deepEqual(x.drafts.get('newtask.root'),taskDraft);A.deepEqual(x.drafts.get('newnote.root'),noteDraft);
});

test('correcting the current execution explicitly marks the user-provided stop time',async()=>{
 const x=setup(),host=sheetHost(x);let call;x.L.run=async fn=>fn();x.L.find=()=>x.row;
 const end=x.L.C.toLocal(new Date(Date.now()-3600000).toISOString());
 Object.assign(x.row,{'任务状态':'进行中','状态开始时间':new Date(Date.now()-7200000).toISOString()});
 x.L.store.setStatus=async(...args)=>{call=args;};x.L.correctCurrent('t1');
 host.d.q('#correctEnd').value=end;host.d.q('#correctStatus').value='暂停';
 await host.events.get('#correctSave:click')({currentTarget:host.d.q('#correctSave')});
 A.equal(call[0],'t1');A.equal(call[1],'暂停');A.equal(call[2],x.L.C.fromLocal(end));A.equal(call[4]?.corrected,true);
});

test('legacy task detail stays open when both its cloud save and local draft fail',async()=>{
 const x=setup();let removed=false,confirmed=false;x.L.toast=()=>{};x.L.updateInert=()=>{};
 x.L.confirm=async()=>{confirmed=true;return true;};x.L.detail={session:{flush:async()=>{throw Error('offline');},flushLocal:()=>false,dispose(){}},element:{remove(){removed=true;}}};
 A.equal(await x.L.closeDetail(),false);A.equal(removed,false);A.equal(confirmed,false);A.ok(x.L.detail);
});

function imageSheet(){
 const x=setup(),notices=[];let uploaded,finish,operation,error;
 x.context.__ONEDAY_SITES__=true;x.L.UI.detailId='t1';x.L.find=()=>x.row;x.L.body=task=>task['任务详情']??task['任务描述']??'';x.L.detail={session:{base:{...x.row}}};
 x.L.toast=(message,action)=>notices.push({message,action});x.L.run=fn=>operation=Promise.resolve().then(fn).catch(e=>{error=e;});
 x.context.OneDayLiteAttachments={create:()=>({uploadImage:(file,owner)=>{uploaded={file,owner};return new Promise(resolve=>finish=resolve);}})};
 // The former base64 transport is deliberately unsupported by Sites.
 x.context.FileReader=class{readAsDataURL(){this.result='data:image/png;base64,AA==';this.onload();}};
 x.L.store.uploadImage=async()=>{throw Error('请选择附件');};
 const input={isConnected:true,value:'上传前正文',selectionStart:2,selectionEnd:4,selectionDirection:'forward',setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}},file={name:'图片.png',type:'image/png',size:4};
 return {x,input,file,notices,get uploaded(){return uploaded;},get error(){return error;},ready:()=>operation,finish:()=>finish({url:'https://oneday.test/api/oneday/files/f1'})};
}

test('legacy task image uses the Sites gateway and keeps text and selection typed during upload',async()=>{
 const s=imageSheet(),saving=s.x.L.insertImage(s.input,value=>{s.input.value=value;},s.file);await new Promise(setImmediate);
 A.equal(s.uploaded?.file,s.file);A.equal(s.uploaded.owner.type,'task');A.equal(s.uploaded.owner.id,'t1');
 s.input.value='上传中继续输入的完整正文';s.input.selectionStart=3;s.input.selectionEnd=7;s.finish();await saving;await s.ready();
 A.match(s.input.value,/^上传中继续输入的完整正文/);A.match(s.input.value,/!\[图片\.png\]\(https:\/\/oneday\.test\/api\/oneday\/files\/f1\)/);
 A.equal(s.input.selectionStart,3);A.equal(s.input.selectionEnd,7);A.equal(s.input.selectionDirection,'forward');A.equal(s.error,undefined);
});

test('a legacy image completed after close is recoverable on the original task, even after navigation',async()=>{
 const s=imageSheet(),saving=s.x.L.insertImage(s.input,()=>{throw Error('closed editor must not be updated');},s.file);await new Promise(setImmediate);
 A.ok(s.uploaded);s.input.isConnected=false;s.x.L.detail=null;s.x.L.UI.detailId='t2';
 s.x.drafts.set('draft.tasks.t1',{base:{...s.x.row},fields:{'任务标题':'未存标题','任务详情':'关闭前的最终草稿'}});
 s.finish();await saving;await s.ready();const draft=s.x.drafts.get('draft.tasks.t1');
 A.equal(draft.fields['任务标题'],'未存标题');A.match(draft.fields['任务详情'],/^关闭前的最终草稿/);A.match(draft.fields['任务详情'],/files\/f1/);A.equal(s.x.drafts.has('draft.tasks.t2'),false);
 let opened;s.x.L.openTask=id=>{opened=id;};await s.notices.at(-1).action.run();A.equal(opened,'t1');A.equal(s.error,undefined);
});

test('a late legacy image does not resurrect a body that was cleared and saved before close',async()=>{
 const s=imageSheet(),saving=s.x.L.insertImage(s.input,()=>{},s.file);await new Promise(setImmediate);
 A.ok(s.uploaded);s.input.isConnected=false;s.x.L.detail=null;s.x.row['任务详情']='';s.finish();await saving;await s.ready();
 A.match(s.x.drafts.get('draft.tasks.t1').fields['任务详情'],/^!\[图片\.png\]/);
});
