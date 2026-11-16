/* Sites-only settings reuse the original OneDay dialog and existing navigation. */
(function(){'use strict';if(!window.__ONEDAY_SITES__)return;
const L=window.OneDayLite,{C,UI,icon}=L,E=C.esc,db=window.__SMART_PAGE__.database;
const names={tasks:'任务',notes:'笔记',logs:'时间日志',tags:'标签',links:'标签关联',sets:'设置',cal:'日历标记'};
L.openCloudImport=function(){
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(file.size>128*1024*1024)return L.toast('备份文件请不超过 128 MB',null,true);
  try{if(L.store.state.pending)throw Error('还有内容正在保存，请等保存完成后导入');const backup=JSON.parse(await file.text());L.toast('正在检查备份和云端记录…');const preview=await db.previewImport(backup);let busy=false;
   const rows=Object.entries(preview.counts).map(([key,n])=>'<div class="settings-line"><span>'+E(names[key]||key)+'</span><strong>'+n+'</strong></div>').join('');
   const conflict=preview.conflicts.length?'<div class="callout danger-text" role="alert">发现 '+preview.conflicts.length+' 条同 ID、不同内容的记录。为保留已有内容，本次导入已阻止。<br>'+preview.conflicts.slice(0,4).map(r=>E((names[r.table]||r.table)+'：'+r.title)).join('<br>')+'</div>':'';
   const d=L.dialog({title:'导入已有 OneDay 备份',body:'<p class="hint">'+E(file.name)+'</p>'+rows+'<div class="callout" style="margin-top:14px">新增 <strong>'+preview.added+'</strong> 条 · 相同记录跳过 <strong>'+preview.skipped+'</strong> 条。已有记录不会被覆盖。</div>'+conflict+'<p class="hint" style="margin-top:14px">附件链接按原样保留。JSON 中的附件清单不包含文件本身，也不会把旧附件重新上传到这里。</p><p class="hint" id="importProgress" aria-live="polite"></p>',footer:'<button class="button" id="importCancel">取消</button><button class="button primary" id="importConfirm" '+(preview.conflicts.length?'disabled':'')+'>合并导入</button>',onClose:()=>{if(busy){d.error('正在导入，请等待结果；关闭页面可能中断当前批次。');return false;}},onMount:d=>{
    d.on('#importCancel','click',()=>d.close());d.on('#importConfirm','click',async e=>{if(busy)return;busy=true;e.currentTarget.disabled=true;d.q('#importCancel').disabled=true;d.q('#importProgress').textContent='正在与云端核对…';
     try{const result=await db.importBackup(backup,p=>d.q('#importProgress').textContent='已处理 '+p.done+' / '+p.total+' 条');await L.store.read();busy=false;d.close(true);L.toast('导入完成：新增 '+result.imported+' 条，相同记录跳过 '+result.skipped+' 条');}
     catch(err){busy=false;d.error(err);d.q('#importConfirm').disabled=false;d.q('#importCancel').disabled=false;}
    });
   }});
  }catch(e){L.handleError(e);}
 };input.click();
};
L.openSettings=function(){const s=L.store.state,total=Object.values(L.store.data).reduce((n,r)=>n+r.length,0);
 const d=L.dialog({title:'数据与设置',body:'<div class="callout"><strong>OneDay 1.8 · 私人空间</strong><br>任务、记录与附件保存在云端。手机和电脑使用同一个 ChatGPT 账号即可继续记录。</div>'+
 '<div class="settings-line"><div class="settings-text"><strong>'+(!s.loaded?'等待连接':s.pending?'正在保存':'已连接云端')+'</strong><small>'+E(s.lastRead?'最近同步：'+new Date(s.lastRead).toLocaleString()+' · '+total+' 条记录':'首次连接后会显示你的记录')+'</small></div><button class="button outline" id="settingsRefresh">同步</button></div>'+
 '<div class="settings-line"><div class="settings-text"><strong>外观</strong><small>只改变此设备的显示</small></div><select class="select-clean" id="themeSelect" aria-label="主题">'+Object.entries(window.OneDayLiteThemes.themes).map(([id,theme])=>[id,theme.name]).map(([v,n])=>'<option value="'+v+'" '+(UI.theme===v?'selected':'')+'>'+n+'</option>').join('')+'</select></div>'+L.appearanceSettingsHTML()+''+
 '<div class="settings-line settings-calendar-marker"><div class="settings-text"><strong>日历标记</strong><small>休假、节日、调休或一个特别的日子</small></div><div class="calendar-marker-editor"><input class="input" id="calendarMarkDate" type="date" value="'+E(UI.date)+'" aria-label="标记日期"><select class="select-clean" id="calendarMarkType" aria-label="标记类型"><option>请假</option><option>法定节假日</option><option>调休上班</option><option>自定义</option></select><input class="input" id="calendarMarkTitle" maxlength="30" placeholder="如：年假 / 中秋节" aria-label="标记名称"><button class="button outline" id="calendarMarkSave">保存</button></div></div>'+
 '<div class="settings-line"><div class="settings-text"><strong>完整记录备份</strong><small>包含七类记录、原 ID 和附件清单；不含附件文件</small></div><button class="button outline" id="exportBackup">'+icon('download',13)+'导出 JSON</button></div>'+
 '<div class="settings-line"><div class="settings-text"><strong>导入已有备份</strong><small>兼容 OneDay V10 / Lite；合并新增，保留云端原记录</small></div><button class="button outline" id="importBackup">选择文件</button></div>'+
 '<div class="settings-line"><div class="settings-text"><strong>未提交草稿</strong><small>仅保留在当前设备，按登录账号隔离</small></div><button class="button outline" id="exportDrafts">导出草稿</button></div>'+
 '<div class="settings-line"><div class="settings-text"><strong>任务回收站</strong><small>误删可恢复，不自动永久清除</small></div><button class="button outline" id="settingsRecycle">查看</button></div>'+
 '<p class="hint" style="margin-top:18px">如果另一设备修改了同一条记录，会提示你核对，未提交草稿仍保留。离线时请保留页面，联网后确认保存。关闭页面不会暂停正在执行的任务。</p>'+
 '<p class="hint" style="margin-top:12px">附件支持图片、PDF、Office 文档和文本，单个不超过 20 MB。<a href="/signout-with-chatgpt?return_to=/" target="_top" style="float:right">退出登录</a></p>',onMount:d=>{L.mountAppearanceSettings(d);
 d.on('#themeSelect','change',e=>L.setTheme(e.target.value));
 d.on('#settingsRefresh','click',e=>L.run(async()=>{await L.store.read();L.toast('已与云端同步');},e.currentTarget));
 d.on('#settingsRecycle','click',()=>{d.close();L.openRecycle();});
 d.on('#importBackup','click',()=>L.openCloudImport());
 d.on('#calendarMarkSave','click',e=>L.run(async()=>{const day=d.q('#calendarMarkDate').value,type=d.q('#calendarMarkType').value,title=d.q('#calendarMarkTitle').value.trim()||type;if(!C.validDate(day))throw Error('请选择有效日期');const existing=L.store.data.cal.find(r=>C.day(r['标记日期'])===day&&r['标记类型']===type),props={'标记日期':{date:day+'T00:00:00Z'},'标记类型':{select:type},'标记标题':{text:title}};if(existing)await L.store.patch('cal',C.id(existing),props,existing);else await L.store.add('cal',props);UI.date=day;L.render();d.close();L.toast('日历标记已保存');},e.currentTarget));
 d.on('#exportBackup','click',e=>L.run(async()=>{if(L.store.state.pending)throw Error('内容正在保存，请等确认后再备份');const backup=await db.exportBackup();L.download('OneDay-Sites-完整记录-'+C.localDay()+'.json',JSON.stringify(backup,null,2),'application/json');L.toast('已从云端导出完整记录与附件清单');},e.currentTarget));
 d.on('#exportDrafts','click',()=>{L.flushDrafts?.();const out={app:'OneDay',edition:'Sites',scope:L.scope,exportedAt:new Date().toISOString(),drafts:L.listDrafts()};L.download('OneDay-未提交草稿-'+C.localDay()+'.json',JSON.stringify(out,null,2),'application/json');});
 }});return d;
};
})();
