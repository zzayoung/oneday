'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');

function setup(saved){
 const styles=new Map(),writes=[],events=new Map(),nodes=new Map(),themeChanges=[];
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',dataset:{},setAttribute(k,v){this[k]=String(v);}});return nodes.get(selector);};
 const document={documentElement:{style:{setProperty:(k,v)=>styles.set(k,String(v))}},querySelector:()=>null};
 const L={C:require('../../src/lite/core.js'),read:(key,fallback)=>key==='markdownStyle'?saved??fallback:fallback,save:(key,value)=>writes.push({key,value:JSON.parse(JSON.stringify(value))}),UI:{theme:'mist-blue'},setTheme:id=>{themeChanges.push(id);L.UI.theme=id;}};
 const context={console,document,OneDayLite:L,OneDayLiteThemes:{themes:{'warm-paper':{name:'暖纸',description:'暖色纸感',palette:['#fff','#222','#765']},'mist-blue':{name:'雾蓝',description:'清透蓝灰',palette:['#fff','#234','#567']},pine:{name:'松间',description:'柔和叶绿',palette:['#fff','#243','#465']},'deep-sea':{name:'深海',description:'深蓝夜色',palette:['#123','#def','#69c']}}}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(ROOT,'src/lite/appearance.js'),'utf8'),context);
 const dialog={q:node,qa:selector=>selector==='[data-appearance-theme]'?Object.keys(context.OneDayLiteThemes.themes).map(id=>{const n=node('theme-'+id);n.dataset.appearanceTheme=id;return n;}):[],on:(selector,type,fn)=>events.set(selector+':'+type,fn)};
 return {L,styles,writes,themeChanges,dialog,node,emit:(selector,type,value)=>{const n=node(selector);if(value!==undefined)n.value=String(value);events.get(selector+':'+type)({target:n,currentTarget:n});}};
}

test('stored Markdown appearance is normalized once into bounded numeric settings',()=>{
 const x=setup({lineHeight:99,before:-2,after:'not-a-number',extra:'ignored'});
 A.deepEqual(JSON.parse(JSON.stringify(x.L.markdownStyle)),{lineHeight:2.4,before:0,after:0.35});
 A.equal(x.styles.get('--md-line-height'),'2.4');A.equal(x.styles.get('--md-block-before'),'0em');A.equal(x.styles.get('--md-block-after'),'0.35em');A.equal(x.writes.length,0);
});

test('malformed stored settings fall back to readable defaults without saving a replacement',()=>{
 for(const saved of ['wrong',[],false]){const x=setup(saved);A.deepEqual(JSON.parse(JSON.stringify(x.L.markdownStyle)),{lineHeight:1.65,before:0,after:0.35});A.equal(x.writes.length,0);}
});

test('sliding a spacing control applies globally and persists before release',()=>{
 const x=setup();x.L.mountAppearanceSettings(x.dialog);
 x.emit('#markdownBefore','input',0.8);
 A.equal(x.styles.get('--md-block-before'),'0.8em');A.equal(x.L.markdownStyle.before,0.8);
 A.equal(x.node('#markdownBeforeValue').textContent,'0.80 em');
 A.equal(x.writes.at(-1).key,'markdownStyle');A.equal(x.writes.at(-1).value.before,0.8);
 x.emit('#markdownLineHeight','input',1.25);A.equal(x.styles.get('--md-line-height'),'1.25');A.equal(x.writes.at(-1).value.lineHeight,1.25);
});

test('reset restores all displayed sliders and the same globally applied settings',()=>{
 const x=setup({lineHeight:2.2,before:1,after:1.3});x.L.mountAppearanceSettings(x.dialog);x.emit('#markdownStyleReset','click');
 A.equal(x.node('#markdownLineHeight').value,'1.65');A.equal(x.node('#markdownBefore').value,'0');A.equal(x.node('#markdownAfter').value,'0.35');
 A.equal(x.styles.get('--md-line-height'),'1.65');A.equal(x.styles.get('--md-block-after'),'0.35em');A.equal(x.writes.at(-1).value.before,0);
});

test('preview contains representative rendered blocks and does not write task content',()=>{
 const x=setup(),html=x.L.appearanceSettingsHTML();
 A.match(html,/Markdown 排版/);A.match(html,/md-preview/);A.match(html,/<h2>/);A.match(html,/<blockquote>/);A.match(html,/<ul/);A.match(html,/<code>/);
 A.match(html,/段前留白/);A.match(html,/段后留白/);A.equal(x.writes.length,0);
});

test('a theme preview selects the real persisted theme and keeps the select control in sync',()=>{
 const x=setup();x.L.mountAppearanceSettings(x.dialog);
 x.emit('[data-appearance-theme="deep-sea"]','click');
 A.deepEqual(x.themeChanges,['deep-sea']);A.equal(x.node('#themeSelect').value,'deep-sea');
});

test('new theme IDs and old saved aliases resolve to supported palettes and meta colors',()=>{
 const document={documentElement:{dataset:{}},querySelector:()=>meta},meta={content:''};const ctx={document,setTimeout,clearTimeout,matchMedia:()=>({matches:false})};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(ROOT,'src/lite/themes.js'),'utf8'),ctx);
 for(const id of ['warm-paper','mist-blue','pine','deep-sea']){A.equal(ctx.OneDayLiteThemes.apply(id),id);A.equal(document.documentElement.dataset.theme,id);A.equal(meta.content,ctx.OneDayLiteThemes.themes[id].color);A.ok(ctx.OneDayLiteThemes.themes[id].description);}
 A.equal(ctx.OneDayLiteThemes.normalize('dark'),'night');A.equal(ctx.OneDayLiteThemes.normalize('light'),'glass-day');A.equal(ctx.OneDayLiteThemes.normalize('paper'),'paper');
});
