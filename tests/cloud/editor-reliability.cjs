const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');

function load(){
 const context={console,setTimeout,clearTimeout,Node:{TEXT_NODE:3,ELEMENT_NODE:1}};
 context.window=context;vm.createContext(context);
 for(const file of ['src/core.js','src/lite/core.js','src/lite/editor.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 return context.OneDayLiteEditor;
}
function text(value){return {nodeType:3,nodeValue:value,get textContent(){return this.nodeValue;}};}
// DOM-shaped input fixtures for the real serializer; no browser or parser substitute.
function el(tag,kids=[],attrs={}){
 const node={nodeType:1,tagName:tag.toUpperCase(),childNodes:kids.map(k=>typeof k==='string'?text(k):k),
  get children(){return this.childNodes.filter(k=>k.nodeType===1);},
  get textContent(){return this.childNodes.map(k=>k.textContent).join('');},
  getAttribute:key=>attrs[key]||null,
  classList:{contains:name=>(attrs.class||'').split(' ').includes(name)},
  querySelectorAll(selector){const tags=selector.split(',').map(s=>s.trim().toUpperCase()),out=[];function walk(n){for(const child of n.children||[]){if(tags.includes(child.tagName))out.push(child);walk(child);}}walk(this);return out;},
  querySelector(selector){if(selector.startsWith(':scope > ')){const direct=selector.slice(9);return this.children.find(n=>direct.startsWith('.')?n.classList.contains(direct.slice(1)):n.tagName===direct.toUpperCase())||null;}return this.querySelectorAll(selector)[0]||null;}
 };
 node.childNodes.forEach(k=>k.parentElement=node);return node;
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

test('serializing a rendered Markdown table retains columns, rows, and inline content',()=>{
 const API=load();
 const table=el('table',[el('thead',[el('tr',[el('th',['名称']),el('th',['说明'])])]),el('tbody',[el('tr',[el('td',[el('strong',['保留'])]),el('td',[el('a',['资料'],{href:'https://example.test/doc'})])])])]);
 const actual=API.serialize(el('div',[el('p',['表格之前']),el('div',[table],{class:'table-scroll'}),el('p',['表格之后'])]));
 A.equal(actual,'表格之前\n| 名称 | 说明 |\n| --- | --- |\n| **保留** | [资料](https://example.test/doc) |\n表格之后');
});

test('attachment upload appends to the latest body after the user keeps typing',async()=>{
 const API=load();A.equal(typeof API.createContentBuffer,'function');
 const flight=deferred(),buffer=API.createContentBuffer({value:'原文'});
 const saving=buffer.upload({name:'photo.png',type:'image/png'},{uploadImage:()=>flight.promise},{type:'note',id:'n1'});
 buffer.setValue('原文\n上传期间补充');
 flight.resolve({url:'https://example.test/photo.png'});await saving;
 A.equal(buffer.value,'原文\n上传期间补充\n\n![photo.png](https://example.test/photo.png)');
 A.equal(buffer.pending,0);
});

test('failed attachment upload leaves all current body edits intact',async()=>{
 const API=load();A.equal(typeof API.createContentBuffer,'function');
 const flight=deferred(),buffer=API.createContentBuffer({value:'原文'});
 const saving=buffer.upload({name:'draft.pdf',type:'application/pdf'},{uploadFile:()=>flight.promise});
 buffer.setValue('原文已被用户完全改写');flight.reject(Error('offline'));
 await A.rejects(saving,/offline/);await buffer.whenReady();
 A.equal(buffer.value,'原文已被用户完全改写');A.equal(buffer.pending,0);
});

test('overlapping uploads preserve both completed attachments and intervening text',async()=>{
 const API=load();A.equal(typeof API.createContentBuffer,'function');
 const flights={a:deferred(),b:deferred()},buffer=API.createContentBuffer({value:'开始'});
 const gateway={uploadFile:file=>flights[file.name].promise};
 const a=buffer.upload({name:'a',type:'text/plain'},gateway),b=buffer.upload({name:'b',type:'text/plain'},gateway);
 A.equal(buffer.pending,2);flights.b.resolve({url:'https://example.test/b'});await b;
 buffer.setValue(buffer.value+'\n新的文字');flights.a.resolve({url:'https://example.test/a'});await a;
 A.match(buffer.value,/\[📎 b\]\(https:\/\/example.test\/b\)/);
 A.match(buffer.value,/新的文字/);A.match(buffer.value,/\[📎 a\]\(https:\/\/example.test\/a\)/);
});

test('selection offset stays in the middle of unchanged visible text after repaint',()=>{
 const API=load();A.equal(typeof API.mapTextOffset,'function');
 A.equal(API.mapTextOffset('中间正在编辑文字','中间正在编辑文字',4),4);
 A.equal(API.mapTextOffset('alpha Xbeta','alpha Xbeta',7),7);
});

test('selection follows rendered Markdown text when a heading or bold delimiter disappears',()=>{
 const API=load();A.equal(typeof API.mapTextOffset,'function');
 A.equal(API.mapTextOffset('## 标题','标题',5),2);
 A.equal(API.mapTextOffset('before **bold** after','before bold after',11),9);
});

test('a blank paragraph stays available for the next character during live editing',()=>{
 const API=load(),body=el('div',[el('p',['第一行']),el('p',[el('br')])]);
 A.equal(API.serialize(body,{preserveWhitespace:true}),'第一行\n');
});

test('upload completion waits for an active composition before inserting into its final text',async()=>{
 const API=load(),composition=deferred();let beforeInsertCalled=false;
 const buffer=API.createContentBuffer({value:'输入',beforeInsert:()=>{beforeInsertCalled=true;return composition.promise;}});
 const saving=buffer.upload({name:'资料.pdf',type:'application/pdf'},{uploadFile:async()=>({url:'https://example.test/notes.pdf'})});
 await new Promise(setImmediate);A.equal(beforeInsertCalled,true);
 A.equal(buffer.value,'输入');buffer.setValue('输入完整的中文');composition.resolve();await saving;
 A.equal(buffer.value,'输入完整的中文\n\n[📎 资料.pdf](https://example.test/notes.pdf)');
});

test('editing nested browser paragraphs preserves each line and repeated blank lines',()=>{
 const API=load(),body=el('div',[el('div',['第一行',el('div',['第二行']),el('div',[el('br')]),el('div',[el('br')]),el('div',['末行'])])]);
 A.equal(API.serialize(body,{preserveWhitespace:true}),'第一行\n第二行\n\n\n末行');
});

test('editing preserves leading and trailing spaces and every blank paragraph',()=>{
 const API=load(),body=el('div',[el('p',[el('br')]),el('p',['  第一行  ']),el('p',[el('br')]),el('p',[el('br')]),el('p',[el('br')])]);
 A.equal(API.serialize(body,{preserveWhitespace:true}),'\n  第一行  \n\n\n');
});

test('attachment insertion preserves preexisting leading and trailing source whitespace',async()=>{
 const API=load(),buffer=API.createContentBuffer({value:'\n  原文  \n'});
 await buffer.upload({name:'a.pdf',type:'application/pdf'},{uploadFile:async()=>({url:'/a.pdf'})});
 A.equal(buffer.value,'\n  原文  \n\n\n[📎 a.pdf](/a.pdf)');
});


test('editing elsewhere does not erase a blank line inside a fenced code block',()=>{
 const API=load(),body=el('div',[el('pre',[el('code',['const answer = 42;\n'])]),el('p',['编辑正文'])]);
 A.equal(API.serialize(body,{preserveWhitespace:true}),'```\nconst answer = 42;\n\n```\n编辑正文');
});

test('checklist serialization includes text typed outside the original label span',()=>{
 const API=load(),body=el('div',[el('ul',[el('li',[el('button',['✓'],{class:'md-check checked'}),el('span',['原有文字']),'后续输入'])])]);
 A.equal(API.serialize(body,{preserveWhitespace:true}),'- [x] 原有文字后续输入');
});
