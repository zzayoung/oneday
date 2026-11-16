'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');

// A small DOM boundary for editor events and selection. Browser editing commands
// are recorded; production serialization, rendering and lifecycle run unchanged.
function setup(value){
 const timers=new Map(),changes=[],commands=[];let seq=0;
 const doc={activeElement:null};
 class Element{
  constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attrs={};this.listeners={};this.dataset={};this.classList={contains:name=>(this.attrs.class||'').split(' ').includes(name)};}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set textContent(value){this.childNodes=[];this.append({nodeType:3,nodeValue:String(value),get textContent(){return this.nodeValue;}});}
  get innerHTML(){return this.childNodes.map(n=>n.nodeType===3?n.nodeValue:'<'+n.tagName.toLowerCase()+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+v+'"').join('')+'>'+(/^(BR|INPUT|HR|IMG)$/.test(n.tagName)?'':n.innerHTML+'</'+n.tagName.toLowerCase()+'>')).join('');}
  set innerHTML(html){this.childNodes=[];const stack=[this];for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){if(token.startsWith('</')){stack.pop();continue;}if(token.startsWith('<')){const node=new Element(token.match(/^<([\w-]+)/)[1]);for(const attr of token.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(attr.index===1)continue;node.setAttribute(attr[1],attr[2]||'');}stack.at(-1).append(node);if(!/^(BR|INPUT|HR|IMG)$/.test(node.tagName))stack.push(node);}else stack.at(-1).append({nodeType:3,nodeValue:token.replace(/&amp;/g,'&'),get textContent(){return this.nodeValue;}});}}
  append(n){n.parentElement=n.parentNode=this;this.childNodes.push(n);}
  setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  matches(selector){return selector.startsWith('.')?this.classList.contains(selector.slice(1)):selector.startsWith('[')?this.attrs[selector.slice(1,-1)]!==undefined:selector.toUpperCase()===this.tagName;}
  closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
  querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}
  querySelector(selector){if(selector.startsWith(':scope > '))return this.children.find(n=>n.matches(selector.slice(9)))||null;return this.querySelectorAll(selector)[0]||null;}
  contains(node){for(;node;node=node.parentElement)if(node===this)return true;return false;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  focus(){doc.activeElement=this;}
 }
 const selection={rangeCount:0,removeAllRanges(){this.rangeCount=0;},addRange(range){this.setBaseAndExtent(range.startContainer,range.startOffset,range.endContainer,range.endOffset);},setBaseAndExtent(a,ai,b,bi){this.rangeCount=1;this.anchorNode=a;this.anchorOffset=ai;this.focusNode=b;this.focusOffset=bi;}};
 doc.execCommand=(...args)=>{commands.push(args);return true;};
 doc.createRange=()=>({selectNodeContents(node){this.node=node;},collapse(toStart){this.startContainer=this.endContainer=this.node;this.startOffset=this.endOffset=toStart?0:this.node.childNodes.length;},setEnd(node,index){this.end=node;this.index=index;},toString(){const nodes=[];function walk(node){if(node.nodeType===3)nodes.push(node);else node.childNodes.forEach(walk);}walk(this.node);let value='';for(const node of nodes){if(node===this.end)return value+node.nodeValue.slice(0,this.index);value+=node.nodeValue;}return value;}});
 doc.createTreeWalker=node=>{const nodes=[];function walk(n){if(n.nodeType===3)nodes.push(n);else n.childNodes.forEach(walk);}walk(node);let i=0;return {nextNode:()=>nodes[i++]||null};};
 const context={console,document:doc,Node:{TEXT_NODE:3,ELEMENT_NODE:1},getSelection:()=>selection,setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id)};context.window=context;vm.createContext(context);
 for(const file of ['src/core.js','src/lite/core.js','src/lite/editor.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
 const root=new Element('div'),editor=context.OneDayLiteEditor.mount(root,{value,onChange:v=>changes.push(v),placeholder:'要做什么'}),surface=root.querySelector('[data-live-md]');
 const emit=(node,type,extra={})=>{const event={target:node,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},...extra};for(const fn of node.listeners[type]||[])fn(event);return event;};
 return {root,editor,surface,selection,changes,commands,emit,get activeElement(){return doc.activeElement;},async tick(){for(const [id,{fn}]of [...timers]){timers.delete(id);await fn();}}};
}

test('focused live formatting retains trailing blank paragraphs and the caret inside the last one',async()=>{
 const x=setup('首行');x.surface.focus();x.surface.innerHTML='<p>## 标题</p><p><br></p><p><br></p>';
 const last=x.surface.children.at(-1);x.selection.setBaseAndExtent(last,0,last,0);x.emit(x.surface,'input');await x.tick();
 A.equal(x.editor.getValue(),'## 标题\n\n');A.equal(x.surface.children[0].tagName,'H2');A.equal(x.surface.children.length,3);
 A.equal(x.selection.anchorNode,x.surface.children[2]);A.equal(x.selection.anchorOffset,0);
});

test('Chinese composition produces one final draft change without a mid-composition repaint',async()=>{
 const x=setup('原文');x.surface.focus();x.emit(x.surface,'compositionstart');
 x.surface.innerHTML='<p>原文zhong</p>';x.emit(x.surface,'input',{isComposing:true});await x.tick();A.deepEqual(x.changes,[]);
 x.surface.innerHTML='<p>原文中文</p>';x.emit(x.surface,'compositionend');await x.tick();A.deepEqual(x.changes,['原文中文']);A.equal(x.editor.flush(),'原文中文');
});

test('toolbar keeps the selected text and applies bold formatting instead of replacing it',()=>{
 const x=setup('选择这些字'),bold=x.root.querySelectorAll('[data-md-insert]').find(b=>b.dataset.mdInsert==='bold');
 const text=x.surface.children[0].childNodes[0];x.selection.setBaseAndExtent(text,2,text,4);
 A.equal(x.emit(x.root,'mousedown',{target:bold}).defaultPrevented,true);
 x.emit(x.root,'click',{target:bold});A.deepEqual(x.commands,[['bold',false,null]]);
 A.equal(x.selection.anchorNode,text);A.equal(x.selection.anchorOffset,2);A.equal(x.selection.focusOffset,4);
});

test('mount, flush and destroy retain untouched Markdown source exactly',()=>{
 const source='\n* 原有列表  \n\n\n5. 原有编号\n',x=setup(source);
 A.equal(x.editor.flush(),source);x.editor.destroy();A.deepEqual(x.changes,[]);
});


test('plain text input does not replace unchanged editable DOM during the render timer',async()=>{
 const x=setup('原文');x.surface.innerHTML='<p>普通文本继续输入</p>';const paragraph=x.surface.children[0];
 x.emit(x.surface,'input');await x.tick();A.equal(x.surface.children[0]===paragraph,true);
});

test('checking a task after inserting a preceding paragraph toggles its current Markdown line',()=>{
 const x=setup('- [ ] 第一项');x.surface.innerHTML='<p>新插入的行</p><ul class="checklist"><li><button class="md-check" data-line="0"></button><span>第一项</span></li></ul>';
 x.emit(x.surface,'click',{target:x.surface.querySelector('.md-check')});A.equal(x.editor.getValue(),'新插入的行\n- [x] 第一项');
});


test('blurring before the live render timer formats pending Markdown without moving focus or selection',async()=>{
 const x=setup('');x.surface.focus();x.surface.innerHTML='<p>## 整理迭代清单</p><p><br></p><p>- [ ] 核对新建流程</p>';
 const text=x.surface.children[2].childNodes[0];x.selection.setBaseAndExtent(text,5,text,5);
 x.emit(x.surface,'input');x.root.focus();x.emit(x.surface,'blur');await x.tick();
 A.equal(x.surface.children[0].tagName,'H2');A.equal(x.surface.children[2].tagName,'UL');
 A.equal(x.editor.getValue(),'## 整理迭代清单\n\n- [ ] 核对新建流程');
 A.equal(x.activeElement===x.root,true);A.equal(x.selection.anchorNode===text,true);
});


test('pasting over the whole rendered document replaces its Markdown instead of inheriting its heading',()=>{
 const x=setup('## 旧标题\n\n- [ ] 旧任务'),heading=x.surface.children[0].childNodes[0],label=x.surface.querySelector('span').childNodes[0];
 x.surface.focus();x.selection.setBaseAndExtent(heading,0,label,label.nodeValue.length);
 const pasted='## 整理迭代清单 · 已验收\n\n- [x] 新建与待分配\n';
 const event=x.emit(x.surface,'paste',{clipboardData:{files:[],getData:()=>pasted}});
 A.equal(event.defaultPrevented,true);A.equal(x.editor.flush(),pasted);A.equal(x.surface.children[0].textContent,'整理迭代清单 · 已验收');
 A.equal(x.surface.children[0].tagName,'H2');A.equal(x.surface.querySelector('.md-check').classList.contains('checked'),true);
 A.deepEqual(x.commands,[]);A.equal(x.selection.anchorNode===x.surface,true);A.equal(x.selection.anchorOffset,x.surface.childNodes.length);
});

test('pasting over a partial selection retains native insertion into the current block',()=>{
 const x=setup('## 保留前后文字\n\n正文'),text=x.surface.children[0].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,2,text,4);
 x.emit(x.surface,'paste',{clipboardData:{files:[],getData:()=> '粘贴内容'}});A.deepEqual(x.commands,[['insertText',false,'粘贴内容']]);
});

test('toolbar offers supported heading, emphasis, list, quote, link and code styles',()=>{
 const x=setup('正文'),kinds=x.root.querySelectorAll('[data-md-insert]').map(b=>b.dataset.mdInsert);
 for(const kind of ['heading1','heading','heading3','bold','italic','strike','check','bullets','numbered','quote','link','code','codeblock','rule'])A.ok(kinds.includes(kind),kind);
});

test('heading and list controls operate on the current selection through native editing commands',()=>{
 const x=setup('选中这段文字'),text=x.surface.children[0].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,2,text,6);
 const click=kind=>x.emit(x.root,'click',{target:x.root.querySelectorAll('[data-md-insert]').find(b=>b.dataset.mdInsert===kind)});
 click('italic');click('strike');click('heading3');click('bullets');click('numbered');click('quote');
 A.deepEqual(x.commands,[['italic',false,null],['strikeThrough',false,null],['formatBlock',false,'h3'],['insertUnorderedList',false,null],['insertOrderedList',false,null],['formatBlock',false,'blockquote']]);
 A.equal(x.selection.anchorOffset,2);A.equal(x.selection.focusOffset,6);
});

test('inline code escapes selected HTML-like text and retains native insertion',()=>{
 const x=setup('code'),text=x.surface.children[0].childNodes[0];text.nodeValue='<b> & code';x.surface.focus();x.selection.setBaseAndExtent(text,0,text,text.nodeValue.length);
 x.emit(x.root,'click',{target:x.root.querySelectorAll('[data-md-insert]').find(b=>b.dataset.mdInsert==='code')});
 A.deepEqual(x.commands,[['insertHTML',false,'<code>&lt;b&gt; &amp; code</code>']]);
});

test('link control validates the entered URL and restores selected text before insertion',()=>{
 const x=setup('查看资料'),text=x.surface.children[0].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,2,text,4);
 x.emit(x.root,'click',{target:x.root.querySelectorAll('[data-md-insert]').find(b=>b.dataset.mdInsert==='link')});
 const input=x.root.querySelector('[data-live-md-link-url]'),apply=x.root.querySelector('[data-live-md-link-apply]'),popover=x.root.querySelector('[data-live-md-link]');
 A.equal(popover.hidden,false);input.value='javascript:alert(1)';x.emit(apply,'click');A.deepEqual(x.commands,[]);A.equal(popover.hidden,false);
 input.value='https://example.test/doc';x.emit(input,'keydown',{key:'Enter'});
 A.deepEqual(x.commands,[['createLink',false,'https://example.test/doc']]);A.equal(popover.hidden,true);A.equal(x.selection.anchorOffset,2);A.equal(x.selection.focusOffset,4);
});

test('code block and divider controls use structures that serialize back into supported Markdown',()=>{
 const x=setup('正文');x.surface.focus();const text=x.surface.children[0].childNodes[0];x.selection.setBaseAndExtent(text,1,text,1);
 for(const kind of ['codeblock','rule'])x.emit(x.root,'click',{target:x.root.querySelectorAll('[data-md-insert]').find(b=>b.dataset.mdInsert===kind)});
 A.deepEqual(x.commands,[['formatBlock',false,'pre'],['insertHorizontalRule',false,null]]);
});

test('Tab indents the selected list item and consumes the event',()=>{
 const x=setup('- parent\n- child'), text=x.surface.querySelectorAll('li')[1].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,2,text,2);
 const event=x.emit(x.surface,'keydown',{key:'Tab'});
 A.equal(event.defaultPrevented,true);A.equal(event.propagationStopped,true);A.equal(x.editor.getValue(),'- parent\n  - child');
});

test('Enter continues an ordered item and Shift+Tab outdents a nested item',()=>{
 const x=setup('1. first\n  1. next'), text=x.surface.querySelectorAll('li')[1].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,4,text,4);
 x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'1. first\n  1. next\n  2. ');
 const empty=x.surface.querySelectorAll('li')[2];x.selection.setBaseAndExtent(empty,0,empty,0);
 x.emit(x.surface,'keydown',{key:'Tab',shiftKey:true});A.equal(x.editor.getValue(),'1. first\n  1. next\n2. ');
});

test('nested Markdown lists render and serialize without flattening',()=>{
 const source='- parent\n  1. ordered\n    - [x] checked\n  - sibling\n- last',x=setup(source);
 A.equal(x.surface.querySelectorAll('li').length,5);A.equal(x.surface.querySelectorAll('ul').length,3);
 x.surface.innerHTML=x.surface.innerHTML+'<p>extra</p>';A.equal(x.editor.flush(),source+'\nextra');
});

test('composition leaves keyboard events and content untouched',()=>{
 const x=setup('- item'),text=x.surface.querySelector('li').childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,2,text,2);x.emit(x.surface,'compositionstart');
 const event=x.emit(x.surface,'keydown',{key:'Tab',isComposing:true});A.equal(event.defaultPrevented,undefined);A.equal(x.editor.getValue(),'- item');
});

test('format menu uses arrows and Enter, while Escape preserves the typed dash',()=>{
 const x=setup('');x.surface.focus();x.surface.innerHTML='<p>-</p>';let text=x.surface.children[0].childNodes[0];x.selection.setBaseAndExtent(text,1,text,1);x.emit(x.surface,'input');
 const menu=x.root.querySelector('[data-live-md-menu]');A.equal(menu.hidden,false);
 x.emit(x.surface,'keydown',{key:'ArrowDown'});x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'1. ');A.equal(menu.hidden,true);
 const y=setup('');y.surface.focus();y.surface.innerHTML='<p>-</p>';text=y.surface.children[0].childNodes[0];y.selection.setBaseAndExtent(text,1,text,1);y.emit(y.surface,'input');y.emit(y.surface,'keydown',{key:'Escape'});A.equal(y.editor.getValue(),'-');A.equal(y.root.querySelector('[data-live-md-menu]').hidden,true);
});

test('Enter exits an empty list item and continues a checklist item unchecked',()=>{
 const x=setup('- [x] done');let label=x.surface.querySelector('span').childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(label,4,label,4);x.emit(x.surface,'keydown',{key:'Enter'});
 A.equal(x.editor.getValue(),'- [x] done\n- [ ] ');const second=x.surface.querySelectorAll('li')[1];x.selection.setBaseAndExtent(second,0,second,0);x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'- [x] done\n');
});

test('Enter continues a quote',()=>{
 const y=setup('> quote');const text=y.surface.children[0].childNodes[0];y.surface.focus();y.selection.setBaseAndExtent(text,5,text,5);y.emit(y.surface,'keydown',{key:'Enter'});A.equal(y.editor.getValue(),'> quote\n> ');
});

test('Ctrl+B consumes the shortcut and keeps the selection for native formatting',()=>{
 const x=setup('selected'),text=x.surface.children[0].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,1,text,5);const e=x.emit(x.surface,'keydown',{key:'b',ctrlKey:true});
 A.equal(e.defaultPrevented,true);A.equal(e.propagationStopped,true);A.deepEqual(x.commands,[['bold',false,null]]);A.equal(x.selection.anchorOffset,1);A.equal(x.selection.focusOffset,5);
});

test('Enter on an empty code line exits the existing fence without duplicating it',()=>{
 const x=setup('```\nline\n\n```'),code=x.surface.querySelector('code'),text=code.childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,5,text,5);x.emit(x.surface,'keydown',{key:'Enter'});
 A.equal(x.editor.getValue(),'```\nline\n\n```\n');
});

test('undo and redo restore structural keyboard edits',()=>{
 const x=setup('- parent\n- child'),text=x.surface.querySelectorAll('li')[1].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,2,text,2);x.emit(x.surface,'keydown',{key:'Tab'});
 x.emit(x.surface,'keydown',{key:'z',ctrlKey:true});A.equal(x.editor.getValue(),'- parent\n- child');
 x.emit(x.surface,'keydown',{key:'z',ctrlKey:true,shiftKey:true});A.equal(x.editor.getValue(),'- parent\n  - child');
});

test('undo steps through ordinary input and a subsequent list indentation',()=>{
 const x=setup('- one\n- two'),text=x.surface.querySelectorAll('li')[1].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,3,text,3);x.emit(x.surface,'keydown',{key:'!'});text.nodeValue='two!';x.selection.setBaseAndExtent(text,4,text,4);x.emit(x.surface,'input');x.emit(x.surface,'keydown',{key:'Tab'});
 x.emit(x.surface,'keydown',{key:'z',ctrlKey:true});A.equal(x.editor.getValue(),'- one\n- two!');x.emit(x.surface,'keydown',{key:'z',ctrlKey:true});A.equal(x.editor.getValue(),'- one\n- two');
});

test('Enter splits formatted text at the visual caret without corrupting Markdown',()=>{
 for(const [source,index,expected] of [['- **bold**',4,'- **bold**\n- '],['- **bold**',2,'- **bo**\n- **ld**'],['> [label](https://example.test)',2,'> [la](https://example.test)\n> [bel](https://example.test)'],['## `code`',2,'## `co`\n## `de`']]){
  const x=setup(source),node=(x.surface.querySelector('strong')||x.surface.querySelector('a')||x.surface.querySelector('code')).childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(node,index,node,index);x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),expected,source);
 }
});

test('Escape then Tab releases focus navigation without inserting indentation',()=>{
 const x=setup('text'),node=x.surface.children[0].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(node,2,node,2);x.emit(x.surface,'keydown',{key:'Escape'});const e=x.emit(x.surface,'keydown',{key:'Tab'});A.equal(e.defaultPrevented,undefined);A.equal(x.editor.getValue(),'text');
});

test('moving the caret dismisses a dash menu before Enter can change another line',()=>{
 const x=setup('first\n');x.surface.focus();x.surface.innerHTML='<p>first</p><p>-</p>';let dash=x.surface.children[1].childNodes[0];x.selection.setBaseAndExtent(dash,1,dash,1);x.emit(x.surface,'input');const first=x.surface.children[0].childNodes[0];x.selection.setBaseAndExtent(first,2,first,2);x.emit(x.surface,'click');x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'first\n-');A.equal(x.root.querySelector('[data-live-md-menu]').hidden,true);
});

test('Enter in fenced code leaves list-like source literal',()=>{
 for(const literal of ['- example','> example','- ']){const x=setup('```\n'+literal+'\n```'),node=x.surface.querySelector('code').childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(node,literal.length,node,literal.length);const e=x.emit(x.surface,'keydown',{key:'Enter'});A.equal(e.defaultPrevented,undefined);A.equal(x.editor.getValue(),'```\n'+literal+'\n```');}
});

test('checkbox toggling supports plus and ordered markers',()=>{
 for(const marker of ['+','1.']){const x=setup(marker+' [ ] task');x.emit(x.surface,'click',{target:x.surface.querySelector('.md-check')});A.equal(x.editor.getValue(),marker+' [x] task');}
});

test('multi-block selections indent together and formatting shortcuts retain the selection',()=>{
 const x=setup('- one\n- two'),items=x.surface.querySelectorAll('li'),a=items[0].childNodes[0],b=items[1].childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(a,0,b,3);let e=x.emit(x.surface,'keydown',{key:'Tab'});A.equal(e.defaultPrevented,true);A.equal(x.editor.getValue(),'  - one\n  - two');
 const y=setup('one\ntwo'),p=y.surface.children;y.surface.focus();y.selection.setBaseAndExtent(p[0].childNodes[0],0,p[1].childNodes[0],3);e=y.emit(y.surface,'keydown',{key:'b',ctrlKey:true});A.equal(e.defaultPrevented,true);A.deepEqual(y.commands,[['bold',false,null]]);A.equal(y.selection.focusOffset,3);
});

test('Enter splits an inline link nested inside emphasis using rendered text positions',()=>{
 const x=setup('- **see [site](https://example.test)**'),a=x.surface.querySelector('a').childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(a,2,a,2);x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'- **see [si](https://example.test)**\n- **[te](https://example.test)**');
});

test('selected sibling list items indent under a preceding item and outdent as a group',()=>{
 const x=setup('- parent\n- one\n- two'),lis=x.surface.querySelectorAll('li');x.surface.focus();x.selection.setBaseAndExtent(lis[1].childNodes[0],0,lis[2].childNodes[0],3);x.emit(x.surface,'keydown',{key:'Tab'});A.equal(x.editor.getValue(),'- parent\n  - one\n  - two');
 const selected=x.selection;x.emit(x.surface,'keydown',{key:'Tab',shiftKey:true});A.equal(x.editor.getValue(),'- parent\n- one\n- two');A.ok(selected.rangeCount);
});

test('Escape dismisses the menu first, then enables Shift+Tab to leave',()=>{
 const x=setup('');x.surface.focus();x.surface.innerHTML='<p>-</p>';const text=x.surface.children[0].childNodes[0];x.selection.setBaseAndExtent(text,1,text,1);x.emit(x.surface,'input');x.emit(x.surface,'keydown',{key:'Escape'});const first=x.emit(x.surface,'keydown',{key:'Tab',shiftKey:true});A.equal(first.defaultPrevented,true);x.emit(x.surface,'keydown',{key:'Escape'});const next=x.emit(x.surface,'keydown',{key:'Tab',shiftKey:true});A.equal(next.defaultPrevented,undefined);
});

test('Enter after an inline image preserves it on the first item',()=>{
 const x=setup('- before ![image](https://example.test/a.png) after'),li=x.surface.querySelector('li');x.surface.focus();x.selection.setBaseAndExtent(li,2,li,2);x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'- before ![image](https://example.test/a.png)\n-  after');
});

test('typing a lone dash inside fenced code does not open the format menu',()=>{
 const x=setup('```\n\n```');x.surface.focus();x.surface.querySelector('code').textContent='-';const text=x.surface.querySelector('code').childNodes[0];x.selection.setBaseAndExtent(text,1,text,1);x.emit(x.surface,'input');A.equal(x.root.querySelector('[data-live-md-menu]').hidden,true);const e=x.emit(x.surface,'keydown',{key:'Enter'});A.equal(e.defaultPrevented,undefined);
});

test('Enter maps inline code containing Markdown markers inside emphasis',()=>{
 const x=setup('- **a `*` b**'),node=x.surface.querySelector('code').childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(node,1,node,1);x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'- **a `*`**\n- ** b**');
});

test('splitting preserves an empty inline link',()=>{
 const x=setup('- before [](https://example.test) after'),li=x.surface.querySelector('li'),text=li.childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(text,3,text,3);x.emit(x.surface,'keydown',{key:'Enter'});A.equal(x.editor.getValue(),'- bef\n- ore [](https://example.test) after');
});

test('inline-code shortcut uses the whole multi-block selection',()=>{
 const x=setup('one\ntwo'),p=x.surface.children;x.surface.focus();x.selection.setBaseAndExtent(p[0].childNodes[0],0,p[1].childNodes[0],3);const e=x.emit(x.surface,'keydown',{key:'`',ctrlKey:true});A.equal(e.defaultPrevented,true);A.deepEqual(x.commands,[['insertHTML',false,'<pre><code>one\ntwo</code></pre>']]);
});

test('group Tab and Shift+Tab preserve selected heading and paragraph semantics',()=>{
 const x=setup('# Heading\nparagraph'),nodes=x.surface.children;x.surface.focus();x.selection.setBaseAndExtent(nodes[0].childNodes[0],0,nodes[1].childNodes[0],9);
 const tab=x.emit(x.surface,'keydown',{key:'Tab'});A.equal(tab.defaultPrevented,true);A.equal(x.editor.getValue(),'# Heading\nparagraph');A.equal(x.surface.children[0].tagName,'H1');
 const shift=x.emit(x.surface,'keydown',{key:'Tab',shiftKey:true});A.equal(shift.defaultPrevented,true);A.equal(x.editor.getValue(),'# Heading\nparagraph');A.equal(x.surface.children[0].tagName,'H1');
});

test('group indentation skips heading and fenced-code lines while indenting selected list items',()=>{
 const x=setup('# Heading\n- parent\n- item\n```\n- literal\n```'),heading=x.surface.children[0].childNodes[0],code=x.surface.querySelector('code').childNodes[0];x.surface.focus();x.selection.setBaseAndExtent(heading,0,code,9);x.emit(x.surface,'keydown',{key:'Tab'});A.equal(x.editor.getValue(),'# Heading\n  - parent\n  - item\n```\n- literal\n```');
});

test('native code-block line breaks survive flush and blur',()=>{
 const x=setup('```\n- example\n```');x.surface.focus();x.surface.innerHTML='<pre><code>- example<br>literal</code></pre>';const code=x.surface.querySelector('code'),text=code.childNodes[2];x.selection.setBaseAndExtent(text,7,text,7);x.emit(x.surface,'input');A.equal(x.editor.flush(),'```\n- example\nliteral\n```');x.root.focus();x.emit(x.surface,'blur');A.equal(x.editor.getValue(),'```\n- example\nliteral\n```');A.equal(x.surface.querySelector('code').textContent,'- example\nliteral');
});

for(const [prefix,tag] of [['# ','H1'],['## ','H2'],['### ','H3'],['#### ','H4']]){
 test(tag+' Enter preserves the heading level and puts the next typed text inside it',async()=>{
  const x=setup(prefix+'Heading'),text=x.surface.children[0].childNodes[0];
  x.surface.focus();x.selection.setBaseAndExtent(text,7,text,7);
  const event=x.emit(x.surface,'keydown',{key:'Enter'});
  A.equal(event.defaultPrevented,true);A.equal(x.editor.getValue(),prefix+'Heading\n'+prefix);
  const empty=x.surface.children[1];A.equal(empty.tagName,tag);A.equal(empty.innerHTML,'<br>');
  A.equal(x.selection.anchorNode,empty);A.equal(x.selection.anchorOffset,0);
  // Model the native insertText mutation at the restored caret, preserving
  // its BR placeholder; production input, serialization and repaint then run.
  x.emit(x.surface,'keydown',{key:'N'});const caret=x.selection.anchorNode;
  caret.innerHTML='Next<br>';const typed=caret.childNodes[0];x.selection.setBaseAndExtent(typed,4,typed,4);
  x.emit(x.surface,'input');await x.tick();
  A.equal(x.editor.flush(),prefix+'Heading\n'+prefix+'Next');A.equal(x.surface.children[1].tagName,tag);
 });
 test(tag+' second Enter exits an empty heading and typing stays in a paragraph',async()=>{
  const x=setup(prefix+'Heading'),text=x.surface.children[0].childNodes[0];
  x.surface.focus();x.selection.setBaseAndExtent(text,7,text,7);x.emit(x.surface,'keydown',{key:'Enter'});
  A.equal(x.surface.children[1].tagName,tag);
  const exit=x.emit(x.surface,'keydown',{key:'Enter'});A.equal(exit.defaultPrevented,true);
  A.equal(x.editor.getValue(),prefix+'Heading\n');const paragraph=x.surface.children[1];A.equal(paragraph.tagName,'P');
  A.equal(x.selection.anchorNode,paragraph);A.equal(x.selection.anchorOffset,0);
  paragraph.textContent='Body';const typed=paragraph.childNodes[0];x.selection.setBaseAndExtent(typed,4,typed,4);
  x.emit(x.surface,'input');await x.tick();A.equal(x.editor.flush(),prefix+'Heading\nBody');A.equal(x.surface.children[1].tagName,'P');
 });
}
