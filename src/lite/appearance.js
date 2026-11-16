/* Device-local typography settings; Markdown content remains unchanged. */
(function(){'use strict';
const L=window.OneDayLite,{C}=L,E=C.esc;
const fields=[
 {key:'lineHeight',id:'markdownLineHeight',label:'行高',min:1.1,max:2.4,initial:1.65,css:'--md-line-height',unit:'倍',suffix:''},
 {key:'before',id:'markdownBefore',label:'段前留白',min:0,max:1.8,initial:0,css:'--md-block-before',unit:'em',suffix:'em'},
 {key:'after',id:'markdownAfter',label:'段后留白',min:0,max:1.8,initial:0.35,css:'--md-block-after',unit:'em',suffix:'em'}
];
const stored=L.read('markdownStyle',{}),saved=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{},settings={};
for(const field of fields){const value=saved[field.key];settings[field.key]=typeof value==='number'&&Number.isFinite(value)?Math.round(Math.min(field.max,Math.max(field.min,value))*20)/20:field.initial;}
L.markdownStyle=settings;
function apply(persist=false){for(const field of fields)document.documentElement.style.setProperty(field.css,settings[field.key]+field.suffix);if(persist)L.save('markdownStyle',{...settings});}
apply();
L.appearanceSettingsHTML=function(){
 const preview='## 把今天，写得舒服一点\n清晰的排版，让记录更轻松。这里可以直接预览行高与段落间距。\n拖动滑块，找到适合自己的阅读节奏。\n- 汇总本周完成的工作\n- 留下一条下一步计划\n> 留白不必很多，刚刚好就好。\n**重点**、*想法*，还有 `一小段代码`。';
 return '<section class="appearance-settings" aria-labelledby="markdownStyleTitle"><div class="appearance-section-head"><div><h3 id="markdownStyleTitle">Markdown 排版</h3><p>拖动即预览，应用于此设备的全部内容。</p></div><button class="button outline" id="markdownStyleReset" type="button">恢复默认</button></div><div class="appearance-sliders">'+fields.map(field=>'<label class="appearance-slider" for="'+field.id+'"><span>'+field.label+'<output id="'+field.id+'Value" for="'+field.id+'">'+settings[field.key].toFixed(2)+' '+field.unit+'</output></span><input id="'+field.id+'" type="range" min="'+field.min+'" max="'+field.max+'" step="0.05" value="'+settings[field.key]+'" aria-label="'+field.label+'"><small>'+ (field.key==='lineHeight'?'同一段内每行文字的高度':'标题、段落与列表项'+(field.key==='before'?'之前':'之后')+'的空隙')+'</small></label>').join('')+'</div><div class="appearance-preview-wrap"><span class="appearance-preview-label">实时预览</span><div class="md-preview appearance-preview" data-appearance-preview>'+C.markdown(preview)+'</div></div></section>'+
 '<section class="appearance-themes" aria-labelledby="appearanceThemeTitle"><div class="appearance-section-head"><div><h3 id="appearanceThemeTitle">换一种心情</h3><p>四套新配色，点击即可切换。</p></div></div><div class="appearance-theme-grid">'+Object.entries(window.OneDayLiteThemes.themes).filter(([,theme])=>theme.palette).map(([id,theme])=>'<button type="button" class="appearance-theme-card" data-appearance-theme="'+id+'" aria-pressed="'+(L.UI.theme===id)+'"><span class="appearance-theme-swatch" style="--swatch-bg:'+theme.palette[0]+';--swatch-paper:'+theme.palette[1]+';--swatch-ink:'+theme.palette[2]+'"><i></i><i></i><i></i></span><strong>'+E(theme.name)+'</strong><small>'+E(theme.description)+'</small></button>').join('')+'</div></section>';
};
L.mountAppearanceSettings=function(d){
 for(const field of fields)d.on('#'+field.id,'input',e=>{settings[field.key]=Number(e.target.value);d.q('#'+field.id+'Value').textContent=settings[field.key].toFixed(2)+' '+field.unit;apply(true);});
 d.on('#markdownStyleReset','click',()=>{for(const field of fields){settings[field.key]=field.initial;d.q('#'+field.id).value=String(field.initial);d.q('#'+field.id+'Value').textContent=field.initial.toFixed(2)+' '+field.unit;}apply(true);});
 for(const button of d.qa('[data-appearance-theme]'))d.on('[data-appearance-theme="'+button.dataset.appearanceTheme+'"]','click',()=>{L.setTheme(button.dataset.appearanceTheme);const select=d.q('#themeSelect');if(select)select.value=L.UI.theme;for(const tile of d.qa('[data-appearance-theme]'))tile.setAttribute('aria-pressed',String(tile.dataset.appearanceTheme===L.UI.theme));});
 d.on('#themeSelect','change',e=>{for(const tile of d.qa('[data-appearance-theme]'))tile.setAttribute('aria-pressed',String(tile.dataset.appearanceTheme===e.target.value));});
};
})();
