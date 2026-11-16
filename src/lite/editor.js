/* OneDay Lite single-surface live Markdown editor. Canonical persistence remains Markdown. */
(function(root,factory){root.OneDayLiteEditor=factory(root.OneDayLiteCore,root);})(typeof window!=='undefined'?window:this,function(C,host){
'use strict';
const esc=C.esc;
function inline(node){
 if(!node)return'';if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';if(node.nodeType!==Node.ELEMENT_NODE)return'';
 const tag=node.tagName.toLowerCase();let kids='',previous=null;
 for(const child of node.childNodes){if(previous&&(/^(P|DIV)$/.test(previous.tagName)||/^(P|DIV)$/.test(child.tagName)))kids+='\n';kids+=inline(child);previous=child;}
 if((tag==='p'||tag==='div')&&node.childNodes.length===1&&node.childNodes[0].tagName==='BR')kids='';
 if(tag==='br')return'\n';if(tag==='strong'||tag==='b')return'**'+kids+'**';if(tag==='em'||tag==='i')return'*'+kids+'*';if(tag==='del'||tag==='s')return'~~'+kids+'~~';
 if(tag==='code'&&node.parentElement?.tagName!=='PRE')return'`'+kids.replace(/`/g,'\\`')+'`';
 if(tag==='a'){const href=node.getAttribute('href')||'';return href?'['+kids+']('+href+')':kids;}
 if(tag==='img'){const src=node.getAttribute('src')||'',alt=node.getAttribute('alt')||'';return src?'!['+alt+']('+src+')':alt;}
 if(tag==='button'&&node.classList.contains('md-check'))return'';
 return kids;
}
// Contenteditable may represent code newlines as BRs or nested blocks;
// textContent omits BRs, so walk the literal code DOM instead.
function codeText(node){
 if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';if(node.nodeType!==Node.ELEMENT_NODE)return'';
 if(node.tagName==='BR')return'\n';
 if(/^(P|DIV)$/.test(node.tagName)&&node.childNodes.length===1&&node.childNodes[0].tagName==='BR')return'';
 let text='',previous=null;for(const child of node.childNodes){if(previous&&(/^(P|DIV)$/.test(previous.tagName||'')||/^(P|DIV)$/.test(child.tagName||'')))text+='\n';text+=codeText(child);previous=child;}return text;
}
function tableMarkdown(table){
 if(table.__onedayTableSource&&table.innerHTML===table.__onedayTableSource.html)return table.__onedayTableSource.markdown;
 const rows=[...table.querySelectorAll('tr')].map(row=>[...row.children].filter(cell=>/^(TH|TD)$/.test(cell.tagName)).map(cell=>inline(cell).trim().replace(/\n/g,' ').replace(/\|/g,'\\|')));
 if(!rows.length)return'';
 const width=Math.max(...rows.map(row=>row.length)),line=row=>'| '+Array.from({length:width},(_,i)=>row[i]||'').join(' | ')+' |';
 return [line(rows[0]),line(Array(width).fill('---')),...rows.slice(1).map(line)].join('\n');
}
function serialize(root,{preserveWhitespace=false}={}){let out=[];
 for(const n of root.childNodes){if(n.nodeType===Node.TEXT_NODE){const v=n.nodeValue||'';if(v)out.push(v);continue;}if(n.nodeType!==Node.ELEMENT_NODE)continue;
  const tag=n.tagName.toLowerCase();
  const table=tag==='table'?n:n.classList?.contains('table-scroll')?n.querySelector('table'):null;
  if(table){out.push(tableMarkdown(table));continue;}
  // A terminal BR is the editable heading's caret placeholder, not a source line.
  if(/^h[1-4]$/.test(tag)){out.push('#'.repeat(Number(tag[1]))+' '+inline(n).replace(/\n$/,''));continue;}
  if(tag==='p'||tag==='div'){out.push(inline(n));continue;}
  if(tag==='blockquote'){out.push(inline(n).split('\n').map(s=>'> '+s).join('\n'));continue;}
  if(tag==='hr'){out.push('---');continue;}
  if(tag==='pre'){out.push('```\n'+codeText(n)+'\n```');continue;}
  if(tag==='ul'||tag==='ol'){
   const walkList=(list,depth)=>{const ordered=list.tagName==='OL',start=Number(list.getAttribute('start'))||1;
    [...list.children].filter(x=>x.tagName==='LI').forEach((li,i)=>{const check=li.querySelector(':scope > .md-check');let body='';
     for(const child of li.childNodes)if(!/^(UL|OL)$/.test(child.tagName||''))body+=inline(child);
     out.push('  '.repeat(depth)+(check?'- ['+(check.classList.contains('checked')?'x':' ')+'] ':ordered?(start+i)+'. ':'- ')+body);
     for(const child of li.children)if(/^(UL|OL)$/.test(child.tagName))walkList(child,depth+1);
    });};walkList(n,0);continue;
  }
  const v=inline(n);if(v)out.push(v);
 }
 const value=out.join('\n');return preserveWhitespace?value:value.trim();
}
// Split an inline Markdown sequence at a rendered-text position, duplicating
// wrappers around split text so each resulting line remains valid Markdown.
function splitInline(source,offset){
 // Match the renderer's precedence: code and links are protected before
 // emphasis is parsed, so punctuation inside them cannot split wrappers.
 const tokens=[],hold=token=>'\uE000'+(tokens.push(token)-1)+'\uE001';
 let text=source.replace(/`([^`]+)`/g,(raw,label)=>hold({raw,label,kind:'code'}));
 text=text.replace(/(!?)\[([^\]\n]*)\]\(([^\s)]+)\)/g,(raw,image,label,url)=>hold({raw,label,url,kind:image?'image':'link'}));
 function divide(value,at){
  const pattern=/\uE000\d+\uE001|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*/g;let before='',after='',index=0,visible=0,match;
  function plain(raw){const cut=Math.max(0,Math.min(raw.length,at-visible));before+=raw.slice(0,cut);after+=raw.slice(cut);visible+=raw.length;}
  while((match=pattern.exec(value))){plain(value.slice(index,match.index));const raw=match[0];
   if(raw[0]==='\uE000'){const token=tokens[Number(raw.slice(1,-1))],safe=token.kind==='code'||C.safeURL(token.url,token.kind==='image');const image=token.kind==='image'&&safe,length=image?1:token.label.length,cut=Math.max(0,Math.min(length,at-visible));
    if(image){if(cut)before+=token.raw;else after+=token.raw;}
    else if(!length&&safe){if(at>visible)before+=token.raw;else after+=token.raw;}
    else if(!safe){before+=token.label.slice(0,cut);after+=token.label.slice(cut);}
    else {const wrap=label=>token.kind==='code'?'`'+label+'`':'['+label+']('+token.url+')';if(cut)before+=wrap(token.label.slice(0,cut));if(cut<length)after+=wrap(token.label.slice(cut));}visible+=length;
   }else{const marker=raw.startsWith('**')?'**':raw.startsWith('~~')?'~~':'*',parts=divide(raw.slice(marker.length,-marker.length),Math.max(0,at-visible));if(parts[0])before+=marker+parts[0]+marker;if(parts[1])after+=marker+parts[1]+marker;visible+=parts[2];}
   index=pattern.lastIndex;
  }
  plain(value.slice(index));return [before,after,visible];
 }
 return divide(text,offset);
}
// Keep the caret's position in visible text when Markdown punctuation is rendered away.
function mapTextOffset(before,after,offset){
 before=String(before||'');after=String(after||'');offset=Math.max(0,Math.min(before.length,offset));
 if(before===after)return offset;if(offset===before.length)return after.length;
 let a=0,b=0;
 while(a<offset&&b<after.length){
  if(before[a]===after[b]){a++;b++;continue;}
  const skipBefore=before.indexOf(after[b],a+1),skipAfter=after.indexOf(before[a],b+1);
  if(skipBefore>=0&&(skipAfter<0||skipBefore-a<=skipAfter-b)){if(offset<=skipBefore)return b;a=skipBefore;}
  else if(skipAfter>=0)b=skipAfter;
  else{a++;b++;}
 }
 return Math.min(b,after.length);
}
// Include visual paragraph boundaries: textContent and Range.toString omit
// empty paragraphs, so their offsets cannot restore a caret after Enter.
function selectionModel(root){
 let text='';const offsets=new Map(),points=[];
 const block=node=>node.nodeType===1&&/^(P|DIV|H[1-4]|UL|OL|LI|BLOCKQUOTE|PRE|TABLE|TR|HR)$/.test(node.tagName);
 function walk(node){
  const positions=[];offsets.set(node,positions);
  if(node.nodeType===3){for(let i=0;i<=node.nodeValue.length;i++){positions[i]=text.length+i;points[text.length+i]=[node,i];}text+=node.nodeValue;return;}
  positions[0]=text.length;
  if(node.tagName==='IMG'){const parent=node.parentElement,index=[...parent.childNodes].indexOf(node);points[text.length]=[parent,index];text+='\uFFFC';points[text.length]=[parent,index+1];return;}
  if(node.tagName==='BR'){if(node.parentElement.childNodes.length!==1){points[text.length]=[node.parentElement,[...node.parentElement.childNodes].indexOf(node)];text+='\n';}return;}
  points[text.length]=[node,0];
  if(node.tagName==='BUTTON'&&node.classList.contains('md-check'))return;
  let previous=null;
  for(let i=0;i<node.childNodes.length;i++){
   const child=node.childNodes[i];if(previous&&(block(previous)||block(child)))text+='\n';positions[i]=text.length;
   if(!(child.tagName==='BUTTON'&&child.classList.contains('md-check')))walk(child);
   positions[i+1]=text.length;previous=child;
  }
 }
 walk(root);return {text,offsets,points};
}
function captureSelection(root){
 const selection=host.getSelection?.();if(!selection?.rangeCount||!root.contains(selection.anchorNode)||!root.contains(selection.focusNode))return null;
 const model=selectionModel(root);
 return {text:model.text,anchor:model.offsets.get(selection.anchorNode)?.[selection.anchorOffset]??0,focus:model.offsets.get(selection.focusNode)?.[selection.focusOffset]??0};
}
function restoreSelection(root,saved){
 if(!saved)return;
 const model=selectionModel(root),point=offset=>model.points[mapTextOffset(saved.text,model.text,offset)]||[root,root.childNodes.length];
 try{const a=point(saved.anchor),b=point(saved.focus),selection=host.getSelection();if(selection.setBaseAndExtent)selection.setBaseAndExtent(...a,...b);else{const range=document.createRange();range.setStart(...a);range.setEnd(...b);selection.removeAllRanges();selection.addRange(range);}}catch(_){}
}
function rememberTables(surface,markdown){
 const lines=markdown.split('\n'),sources=[];let inCode=false;
 for(let i=0;i<lines.length;i++){
  if(/^\s*```/.test(lines[i])){inCode=!inCode;continue;}
  if(inCode||!lines[i].includes('|')||!/^\s*\|?\s*:?-{3,}/.test(lines[i+1]||''))continue;
  const start=i;i+=2;while(i<lines.length&&lines[i].includes('|'))i++;sources.push(lines.slice(start,i).join('\n'));i--;
 }
 surface.querySelectorAll('.table-scroll table').forEach((table,i)=>{if(sources[i])table.__onedayTableSource={markdown:sources[i],html:table.innerHTML};});
}
function createContentBuffer({value='',onChange=()=>{},onPending=()=>{},beforeInsert=()=>{}}={}){
 let markdown=String(value||'');const uploads=new Set();
 function setValue(value,notify=true){const next=String(value??'');if(next===markdown)return;markdown=next;if(notify)onChange(markdown);}
 function upload(file,attachments,owner){
  const operation=(async()=>{
   if(!attachments)throw Error('当前环境尚未开放附件上传');
   const isImage=(file.type||'').startsWith('image/'),item=await (isImage?attachments.uploadImage(file,owner):attachments.uploadFile(file,owner));
   await beforeInsert();
   const label=String(file.name||'附件').replace(/[\[\]\r\n]/g,''),url=String(item.url||'').replace(/\)/g,'%29').replace(/\s/g,ch=>encodeURIComponent(ch));
   const insert=(isImage?'![':'[📎 ')+label+']('+url+')';
   setValue(markdown+(markdown?'\n\n':'')+insert);return item;
  })();
  uploads.add(operation);onPending(uploads.size);
  const settled=()=>{uploads.delete(operation);onPending(uploads.size);};operation.then(settled,settled);return operation;
 }
 return {get value(){return markdown;},get pending(){return uploads.size;},setValue,upload,async whenReady(){while(uploads.size)await Promise.allSettled([...uploads]);}};
}
function caretEnd(node){try{const r=document.createRange();r.selectNodeContents(node);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);}catch(_){}}
function mount(root,{value='',onChange=()=>{},onError=()=>{},attachments=null,owner=null,placeholder='写下内容…'}={}){
 let destroyed=false,timer=0,composing=false,capturedHTML='',readOnly=false,unregister=null,toolbarSelection=null,linkSelection=null,menuIndex=0,menuOpen=false,menuOrigin=null,releaseTab=false;const compositionWaiters=[],history=[{value:String(value||''),selection:null}];let historyIndex=0;
 const buffer=createContentBuffer({value,onChange,beforeInsert:async()=>{while(composing&&!destroyed)await new Promise(resolve=>compositionWaiters.push(resolve));commit();}});
 root.innerHTML='<div class="live-md-toolbar" role="toolbar" aria-label="Markdown 样式">'+[
  ['heading1','H1','一级标题'],['heading','H2','二级标题'],['heading3','H3','三级标题'],['bold','<b>B</b>','加粗'],['italic','<i>I</i>','斜体'],['strike','<s>S</s>','删除线'],['check','☑','待办清单'],['bullets','• 列表','无序列表'],['numbered','1. 列表','有序列表'],['quote','❝','引用'],['link','链接','插入链接'],['code','&lt;/&gt;','行内代码'],['codeblock','代码块','代码块'],['rule','—','分隔线']
 ].map(([kind,label,title])=>'<button type="button" data-md-insert="'+kind+'" title="'+title+'" aria-label="'+title+'">'+label+'</button>').join('')+'<span class="md-toolbar-divider" aria-hidden="true"></span><button type="button" data-md-attach title="上传图片或文件">附件</button><input type="file" data-live-md-file hidden multiple></div><div class="live-md-link-popover" data-live-md-link hidden role="group" aria-label="插入链接"><label>链接地址<input data-live-md-link-url type="text" inputmode="url" placeholder="https://" aria-label="链接地址"></label><button type="button" data-live-md-link-apply>插入</button><button type="button" data-live-md-link-cancel>取消</button></div><p class="live-md-link-error" data-live-md-link-error role="alert" hidden></p><div class="live-md-menu" data-live-md-menu hidden role="listbox" aria-label="插入格式"></div><p class="live-md-help">输入 - 选择格式 · Tab / Shift+Tab 缩进 · Ctrl/⌘ B、I、K 格式化 · Esc 后 Tab 离开</p><div class="live-md-surface" data-live-md contenteditable="true" role="textbox" aria-multiline="true" aria-label="'+esc(placeholder)+'" data-placeholder="'+esc(placeholder)+'"></div>';
 const surface=root.querySelector('[data-live-md]'),fileInput=root.querySelector('[data-live-md-file]'),linkBox=root.querySelector('[data-live-md-link]'),linkInput=root.querySelector('[data-live-md-link-url]'),linkError=root.querySelector('[data-live-md-link-error]'),menu=root.querySelector('[data-live-md-menu]');
 const menuItems=[['bullets','无序列表','- '],['numbered','有序列表','1. '],['check','待办清单','- [ ] '],['heading1','一级标题','# '],['heading','二级标题','## '],['heading3','三级标题','### '],['quote','引用','> '],['codeblock','代码块','```'],['rule','分隔线','---']];
 function render(focus=false){
  if(destroyed||composing)return;const saved=document.activeElement===surface?captureSelection(surface):null;
  // The renderer represents blank Markdown lines with empty HTML output. Give
  // those lines actual editable paragraphs while leaving fenced code intact.
  const html=C.markdown(buffer.value).replace(/<pre>[\s\S]*?<\/pre>|(^|\n)(?=\n|$)/g,(part,lead)=>lead===undefined?part:lead+'<p><br></p>');
  // Empty headings need a visible caret container before the first character.
  const next=html.replace(/<h([1-4])><\/h\1>/g,'<h$1><br></h$1>').replace(/<pre>[\s\S]*?<\/pre>|\n/g,part=>part==='\n'?'':part).replace(/<button /g,'<button contenteditable="false" ');
  if(surface.innerHTML===next)return;
  surface.innerHTML=next;
  rememberTables(surface,buffer.value);capturedHTML=surface.innerHTML;if(focus)surface.focus();restoreSelection(surface,saved);
 }
 function commit({repaint=false}={}){if(destroyed)return buffer.value;clearTimeout(timer);if(surface.innerHTML!==capturedHTML){const next=serialize(surface,{preserveWhitespace:true});capturedHTML=surface.innerHTML;buffer.setValue(next);}if(repaint&&!composing)render(document.activeElement===surface);return buffer.value;}
 function schedule(){clearTimeout(timer);if(!composing)timer=setTimeout(()=>commit({repaint:true}),220);}
 async function upload(file){if(!file||readOnly)return;commit();try{await buffer.upload(file,attachments,owner);if(!destroyed){render(document.activeElement===surface);rememberHistory();}}catch(e){onError(e);}}
 render(false);
 const selectionChanged=()=>{if(!menuOpen)return;const pos=currentPosition();if(!pos||!menuOrigin||pos.line!==menuOrigin.line||pos.anchor!==menuOrigin.anchor||pos.focus!==menuOrigin.focus)hideMenu();};document.addEventListener?.('selectionchange',selectionChanged);
 function positionAt(node,offset){
  let element=node.nodeType===1?node:node.parentElement,li=null,block=element;
  for(let p=element;p&&p!==surface;p=p.parentElement){if(p.tagName==='LI'&&!li)li=p;block=p;}
  const model=selectionModel(li||block),column=model.offsets.get(node)?.[offset];if(column===undefined)return null;
  let line=0;if(li&&li.dataset.mdLine!==undefined)line=Number(li.dataset.mdLine);else{for(const child of surface.childNodes){if(child===block)break;line+=serialize({childNodes:[child]},{preserveWhitespace:true}).split('\n').length;}if(block.tagName==='PRE')line+=model.text.slice(0,column).split('\n').length;}
  return {line,column,text:model.text};
 }
 function currentPosition(){
  const sel=host.getSelection?.();if(!sel?.rangeCount||!surface.contains(sel.anchorNode)||!surface.contains(sel.focusNode))return null;
  const a=positionAt(sel.anchorNode,sel.anchorOffset),b=positionAt(sel.focusNode,sel.focusOffset);if(!a||!b)return null;
  return {line:a.line,anchor:a.column,focus:b.column,text:a.text,focusLine:b.line,multi:a.line!==b.line};
 }
 function placeAtLine(line,column){
  let target=[...surface.querySelectorAll('li')].find(li=>Number(li.dataset.mdLine)===line),cursor=0;
  if(!target){for(const child of surface.childNodes){const count=serialize({childNodes:[child]},{preserveWhitespace:true}).split('\n').length;if(line<cursor+count){target=child;break;}cursor+=count;}}
  if(!target)return;const model=selectionModel(target),point=model.points[Math.max(0,Math.min(column,model.text.length))]||[target,0];
  try{host.getSelection().setBaseAndExtent(point[0],point[1],point[0],point[1]);}catch(_){}
 }
 function rememberHistory(){const selection=captureSelection(surface),value=buffer.value;if(history[historyIndex]?.value===value){history[historyIndex].selection=selection;return;}history.splice(historyIndex+1);history.push({value,selection});if(history.length>100)history.shift();historyIndex=history.length-1;}
 function stepHistory(delta){const next=historyIndex+delta;if(next<0||next>=history.length)return false;historyIndex=next;buffer.setValue(history[next].value);render(true);restoreSelection(surface,history[next].selection);return true;}
 function replaceLine(line,replacement,caretLine,caretColumn){const lines=buffer.value.split('\n');lines.splice(line,1,...replacement);buffer.setValue(lines.join('\n'));render(true);placeAtLine(caretLine,caretColumn);rememberHistory();}
 function hideMenu(){menuOpen=false;menuOrigin=null;menu.hidden=true;surface.removeAttribute?.('aria-activedescendant');}
 function showMenu(){menuOpen=true;menu.hidden=false;menu.innerHTML=menuItems.map((item,i)=>'<div role="option" id="live-md-option-'+i+'" aria-selected="'+(i===menuIndex)+'">'+item[1]+'</div>').join('');surface.setAttribute('aria-activedescendant','live-md-option-'+menuIndex);}
 function consume(e){e.preventDefault();e.stopPropagation();}
 function insideFence(lines,line){let inside=false;for(let i=0;i<line;i++)if(/^\s*```/.test(lines[i]))inside=!inside;return inside;}
 surface.addEventListener('keydown',e=>{
  if(readOnly||composing||e.isComposing||e.keyCode===229)return;
  const pos=currentPosition();if(!pos)return;const modifier=e.ctrlKey||e.metaKey;if(modifier&&!e.altKey&&(e.key.toLowerCase()==='z'||e.key.toLowerCase()==='y')){const redo=e.key.toLowerCase()==='y'||e.shiftKey;stepHistory(redo?1:-1);consume(e);return;}if(history[historyIndex]?.value===buffer.value)history[historyIndex].selection=captureSelection(surface);const lines=buffer.value.split('\n'),line=lines[pos.line]||'';
  if(menuOpen&&(!menuOrigin||pos.line!==menuOrigin.line||pos.anchor!==menuOrigin.anchor||pos.focus!==menuOrigin.focus||line!=='-'))hideMenu();
  if(e.key==='Escape'&&!menuOpen){consume(e);releaseTab=true;return;}if(e.key==='Tab'&&releaseTab){releaseTab=false;return;}if(e.key!=='Shift')releaseTab=false;
  if(menuOpen){if(e.key==='Escape'){consume(e);hideMenu();return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){consume(e);menuIndex=(menuIndex+(e.key==='ArrowDown'?1:-1)+menuItems.length)%menuItems.length;showMenu();return;}if(e.key==='Enter'){consume(e);const item=menuItems[menuIndex];hideMenu();if(item[0]==='codeblock')replaceLine(pos.line,['```','','```'],pos.line+1,0);else if(item[0]==='rule')replaceLine(pos.line,['---',''],pos.line+1,0);else replaceLine(pos.line,[item[2]],pos.line,0);return;}if(e.key.length===1)hideMenu();}
  if((e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase();if(key==='b'||key==='i'){consume(e);document.execCommand(key==='b'?'bold':'italic',false,null);commit({repaint:true});rememberHistory();return;}if(key==='k'){consume(e);toolbarSelection=captureSelection(surface);surface.focus();linkSelection=toolbarSelection;linkBox.hidden=false;linkError.hidden=true;linkInput.value='';linkInput.focus();return;}if(key==='`'){consume(e);const selection=captureSelection(surface),selected=selection?selection.text.slice(Math.min(selection.anchor,selection.focus),Math.max(selection.anchor,selection.focus)):'';document.execCommand('insertHTML',false,(selected.includes('\n')?'<pre><code>':'<code>')+esc(selected||'代码')+(selected.includes('\n')?'</code></pre>':'</code>'));commit({repaint:true});rememberHistory();return;}}
  const fence=insideFence(lines,pos.line);
  const match=line.match(/^(\s*)([-*+]|\d+\.)\s+(?:\[([ xX])\]\s*)?(.*)$/);
  if(e.key==='Tab'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){consume(e);if(pos.multi){const saved=captureSelection(surface),first=Math.min(pos.line,pos.focusLine),last=Math.max(pos.line,pos.focusLine);for(let i=first;i<=last;i++){if(insideFence(lines,i)||!/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i]))continue;lines[i]=e.shiftKey?lines[i].replace(/^(?: {1,2}|\t)/,''):'  '+lines[i];}const next=lines.join('\n');if(next!==buffer.value){buffer.setValue(next);render(true);restoreSelection(surface,saved);rememberHistory();}return;}if(match&&!fence){const indent=match[1],next=e.shiftKey?indent.replace(/^(?: {1,2}|\t)/,''):indent+'  ';replaceLine(pos.line,[next+line.slice(indent.length)],pos.line,pos.anchor);}else if(!e.shiftKey)document.execCommand('insertText',false,'  ');return;}
  if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey||pos.multi||pos.anchor!==pos.focus)return;
  if(fence){if(line.trim()===''){consume(e);if(/^\s*```/.test(lines[pos.line+1]||'')){lines.splice(pos.line+2,0,'');buffer.setValue(lines.join('\n'));render(true);placeAtLine(pos.line+2,0);rememberHistory();}else replaceLine(pos.line,['','```',''],pos.line+2,0);}return;}
  if(match){consume(e);const prefix=match[1]+(match[3]!==undefined?'- [ ] ': /^\d/.test(match[2])?(parseInt(match[2],10)+1)+'. ':match[2]+' '),content=match[4],[left,right]=splitInline(content,pos.anchor);
   if(!content.trim()){replaceLine(pos.line,[match[1].length?match[1].slice(2)+line.slice(match[1].length):''],pos.line,0);return;}
   replaceLine(pos.line,[line.slice(0,line.length-content.length)+left,prefix+right],pos.line+1,0);return;}
  const quote=line.match(/^(\s*>\s?)(.*)$/),heading=line.match(/^(#{1,4}\s+)(.*)$/);
  if(quote||heading){consume(e);const m=quote||heading,[left,right]=splitInline(m[2],pos.anchor);if(!m[2].trim()){replaceLine(pos.line,[''],pos.line,0);return;}replaceLine(pos.line,[m[1]+left,m[1]+right],pos.line+1,0);return;}

 });
 surface.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});surface.addEventListener('compositionend',()=>{composing=false;commit();rememberHistory();compositionWaiters.splice(0).forEach(resolve=>resolve());schedule();});
 surface.addEventListener('input',e=>{if(composing||e.isComposing)return;commit();rememberHistory();const pos=currentPosition();if(pos&&!pos.multi&&pos.anchor===pos.focus&&!insideFence(buffer.value.split('\n'),pos.line)&&buffer.value.split('\n')[pos.line]==='-'){menuOrigin={line:pos.line,anchor:pos.anchor,focus:pos.focus};showMenu();}else hideMenu();schedule();});surface.addEventListener('blur',()=>{hideMenu();toolbarSelection=captureSelection(surface);commit({repaint:true});});
 surface.addEventListener('pointerdown',hideMenu);surface.addEventListener('click',e=>{hideMenu();const b=e.target.closest('.md-check');if(!b||readOnly)return;e.preventDefault();const index=[...surface.querySelectorAll('.md-check')].indexOf(b);commit({repaint:true});const current=surface.querySelectorAll('.md-check')[index];if(!current)return;buffer.setValue(C.toggleCheck(buffer.value,Number(current.dataset.line)));render(true);rememberHistory();});
 surface.addEventListener('paste',e=>{
  const files=[...(e.clipboardData?.files||[])],image=files.find(f=>(f.type||'').startsWith('image/'));
  if(image){e.preventDefault();upload(image);return;}
  const text=e.clipboardData?.getData('text/plain');if(text==null)return;e.preventDefault();
  const selected=captureSelection(surface);
  // Replacing the entire document supplies new Markdown source. Native text
  // insertion otherwise inherits an old H2/list wrapper and doubles its syntax.
  if(!composing&&selected&&Math.min(selected.anchor,selected.focus)===0&&Math.max(selected.anchor,selected.focus)===selected.text.length){
   clearTimeout(timer);buffer.setValue(text);render(true);caretEnd(surface);rememberHistory();return;
  }
  document.execCommand('insertText',false,text);schedule();
 });
 surface.addEventListener('dragover',e=>{if(e.dataTransfer?.files?.length)e.preventDefault();});surface.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(!f)return;e.preventDefault();upload(f);});
 for(const event of ['pointerdown','mousedown'])root.addEventListener(event,e=>{if(e.target.closest('[data-md-insert]')){toolbarSelection=captureSelection(surface)||toolbarSelection;e.preventDefault();}});
 root.addEventListener('click',e=>{if(readOnly||composing)return;const ins=e.target.closest('[data-md-insert]');if(ins){toolbarSelection=captureSelection(surface)||toolbarSelection;surface.focus();restoreSelection(surface,toolbarSelection);const kind=ins.dataset.mdInsert;
  const command={bold:'bold',italic:'italic',strike:'strikeThrough',bullets:'insertUnorderedList',numbered:'insertOrderedList',rule:'insertHorizontalRule'}[kind];
  if(command)document.execCommand(command,false,null);
  else if(['heading1','heading','heading3','quote','codeblock'].includes(kind))document.execCommand('formatBlock',false,{heading1:'h1',heading:'h2',heading3:'h3',quote:'blockquote',codeblock:'pre'}[kind]);
  else if(kind==='link'){commit();linkSelection=captureSelection(surface);linkBox.hidden=false;linkError.hidden=true;const anchor=host.getSelection()?.anchorNode?.parentElement?.closest('a');linkInput.value=anchor&&surface.contains(anchor)?anchor.getAttribute('href'):'';linkInput.focus();return;}
  else if(kind==='code'){const selected=captureSelection(surface),text=selected?selected.text.slice(Math.min(selected.anchor,selected.focus),Math.max(selected.anchor,selected.focus)):'';document.execCommand('insertHTML',false,(text.includes('\n')?'<pre><code>':'<code>')+esc(text||'代码')+(text.includes('\n')?'</code></pre>':'</code>'));}
  else document.execCommand('insertText',false,(buffer.value?'\n':'')+'- [ ] ');
  commit({repaint:true});rememberHistory();return;}if(e.target.closest('[data-md-attach]'))fileInput.click();});
 function insertLink(){
  if(readOnly||composing)return;const url=C.safeURL(linkInput.value.trim());
  if(!url){linkError.textContent='请输入有效的 http、https 或站内链接。';linkError.hidden=false;linkInput.focus();return;}
  surface.focus();restoreSelection(surface,linkSelection);
  if(linkSelection&&linkSelection.anchor!==linkSelection.focus)document.execCommand('createLink',false,url);else document.execCommand('insertHTML',false,'<a href="'+esc(url)+'">'+esc(url)+'</a>');
  linkBox.hidden=true;linkError.hidden=true;linkSelection=null;commit({repaint:true});rememberHistory();
 }
 root.querySelector('[data-live-md-link-apply]').addEventListener('click',insertLink);
 root.querySelector('[data-live-md-link-cancel]').addEventListener('click',()=>{linkBox.hidden=true;linkError.hidden=true;surface.focus();restoreSelection(surface,linkSelection);linkSelection=null;});
 linkInput.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();e.stopPropagation();insertLink();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();linkBox.hidden=true;linkError.hidden=true;surface.focus();restoreSelection(surface,linkSelection);linkSelection=null;}});
 fileInput.addEventListener('change',async()=>{const files=[...fileInput.files];for(const f of files)await upload(f);fileInput.value='';});
 unregister=host.OneDayLite?.registerDraftSource?.({flushLocal:()=>{commit();return true;},isDirty:()=>buffer.pending>0||(!destroyed&&surface.innerHTML!==capturedHTML)});
 return {getValue:()=>buffer.value,get pendingUploads(){return buffer.pending;},setValue(v){buffer.setValue(v,false);render(false);history.splice(0,history.length,{value:buffer.value,selection:null});historyIndex=0;},setReadOnly(value){if(readOnly===!!value)return;readOnly=!!value;surface.contentEditable=readOnly?'false':'true';surface.setAttribute('aria-readonly',String(readOnly));root.querySelectorAll('.live-md-toolbar button').forEach(button=>button.disabled=readOnly);if(readOnly)linkBox.hidden=true;},flush:()=>commit(),async whenReady(){commit();await buffer.whenReady();return buffer.value;},destroy(){if(destroyed)return;commit();destroyed=true;document.removeEventListener?.('selectionchange',selectionChanged);composing=false;compositionWaiters.splice(0).forEach(resolve=>resolve());clearTimeout(timer);if(buffer.pending)buffer.whenReady().then(()=>unregister?.());else unregister?.();},focus(){surface.focus();caretEnd(surface);}};
}
return {mount,serialize,createContentBuffer,mapTextOffset};
});
