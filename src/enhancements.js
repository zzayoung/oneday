  /* OneDay v10: capture → choose → focus → reflect. Shares the original seven tables. */
  function odIcon(name,size){
    var paths={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
      task:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/>',note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8m-8 4h5"/>',
      review:'<path d="M4 19h16M7 15V9m5 6V5m5 10v-4"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',
      arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',star:'<path d="m12 3 2.7 5.8 6.3.8-4.6 4.5 1.1 6.4L12 17.4l-5.5 3.1 1.1-6.4L3 9.6l6.3-.8z"/>',
      inbox:'<path d="m5 4-3 9v7h20v-7l-3-9zM2 13h6l2 3h4l2-3h6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<path d="m5 12 4 4L19 6"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',leaf:'<path d="M20 4C8 2 2 7 5 16s17 3 15-12zM5 19l10-10"/>'};
    return '<svg width="'+(size||20)+'" height="'+(size||20)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.task)+'</svg>';
  }
  function odInputSnapshot(){var el=document.activeElement;if(!el||!el.id||!$('viewHost').contains(el)||el.tagName!=='INPUT')return null;return {id:el.id,start:el.selectionStart,end:el.selectionEnd};}
  function odRestoreInput(v){if(!v)return;var el=$(v.id);if(el){el.focus({preventScroll:true});try{el.setSelectionRange(v.start,v.end);}catch(e){}}}
  function odChrome(){
    if(!$('odNotice')){var n=document.createElement('div');n.id='odNotice';$('taskBar').insertAdjacentElement('beforebegin',n);}
    if(!$('odTools')){
      var tools=document.createElement('div');tools.id='odTools';tools.className='od-tools';
      tools.innerHTML='<button class="od-search-button" data-od="search" aria-label="全局搜索，Control 或 Command K">'+odIcon('search',17)+'<span>搜索</span><kbd>⌘ K</kbd></button><button id="odSync" data-od="data" aria-label="连接状态与数据备份"></button>';
      document.querySelector('.menu-wrap').insertAdjacentElement('beforebegin',tools);
      $('btnMenu').setAttribute('aria-label','打开更多菜单');$('btnNew').setAttribute('aria-label','新建任务或便签');
      $('sideSub').textContent='为重要的事，留一点空间。';
    }
    if(!$('odBottomNav')){var nav=document.createElement('nav');nav.id='odBottomNav';nav.setAttribute('aria-label','主导航');document.body.appendChild(nav);}
    $('odBottomNav').innerHTML=TABS.map(function(t,i){return (i===2?'<button class="od-bottom-add" data-od="new" aria-label="新建">'+odIcon('plus',26)+'</button>':'')+'<button data-tab="'+t.k+'" '+(S.tab===t.k?'aria-current="page" class="on"':'')+'>'+odIcon(['sun','task','note','review'][i])+'<span>'+t.label+'</span></button>';}).join('');
    $('taskBar').classList.toggle('od-hide-bar',S.tab==='today'||S.tab==='review');
    document.documentElement.setAttribute('data-od-tab',S.tab);
    Array.prototype.forEach.call($('mainNav').querySelectorAll('button'),function(b){b.setAttribute('aria-pressed',b.getAttribute('data-tab')===S.tab?'true':'false');});
    odSyncPaint();odFocusPaint();
  }
  function odDateLabel(ds){var d=dparse(ds);return d.getFullYear()+' 年 '+(d.getMonth()+1)+' 月 '+d.getDate()+' 日 · 周'+'日一二三四五六'[d.getDay()];}
  function odRealDay(s){var d=parseDT(s);return d?dstr(d):'';}
  function odEmpty(title,body,action){return '<div class="od-empty">'+odIcon('leaf',32)+'<strong>'+esc(title)+'</strong><p>'+esc(body)+'</p>'+(action||'')+'</div>';}
  function odRow(t,opts){
    opts=opts||{};var id=rid(t),done=!odActive(t),p=t['优先级']||'',tags=tagsOf(id),start=t['计划开始时间'],end=t['计划截止时间'];
    var time=start?fmtDay(start)+' '+odTime(start):end?'截止 '+fmtDay(end):'未安排时间';
    if(start&&end&&dayOf(start)===dayOf(end)){time=fmtDay(start)+' · '+((odTime(start)==='00:00'&&odTime(end)==='23:59')?'全天':odTime(start)+'–'+odTime(end));}
    var pins=odPins(),pinned=pins.indexOf(id)>=0;
    return '<article class="od-row'+(done?' is-done':'')+'">'+
      '<button class="od-check" data-od-check="'+esc(id)+'" aria-label="'+(done?'重新开始':'完成任务')+' '+esc(t['任务标题'])+'" '+(done?'aria-pressed="true"':'aria-pressed="false"')+'>'+(done?odIcon('check',14):'')+'</button>'+
      '<button class="od-row-body" data-open="'+esc(id)+'"><span class="od-row-title">'+esc(t['任务标题']||'无标题任务')+'</span><span class="od-row-meta">'+
      (p?'<i class="od-priority '+(p==='高'||p==='紧急'?'high':'')+'">'+esc(p)+'</i>':'')+
      '<span>'+esc(stMeta(t['任务状态']||ST_DEFAULT).s)+'</span><span>'+esc(time)+'</span>'+tags.slice(0,2).map(function(n){return '<span class="od-tag">#'+esc(n)+'</span>';}).join('')+
      (t['父任务ID']?'<span>↳ 子任务</span>':'')+'</span></button>'+
      '<div class="od-row-actions">'+(!done?'<button data-od-pin="'+esc(id)+'" class="od-pin '+(pinned?'pinned':'')+'" title="'+(pinned?'移出':'加入')+'当日重点" aria-label="'+(pinned?'移出':'加入')+'当日重点">'+odIcon('star',17)+'</button><button data-od-schedule="'+esc(id)+'" title="快速安排" aria-label="快速安排">'+odIcon('clock',17)+'</button>':'')+'</div></article>';
  }
  function odCaptureBox(){
    return '<section class="od-capture"><div class="od-capture-line"><span>'+odIcon('plus',24)+'</span><input id="odCapture" maxlength="1000" autocomplete="off" aria-label="快速收集任务" placeholder="先记下来，把脑袋腾空一点…" value="'+esc(OD.capture||odRead('capture',''))+'"><button id="odCaptureSubmit" data-od="capture" class="od-primary"'+(OD.busyCapture?' disabled':'')+'>收下 '+odIcon('arrow',17)+'</button></div>'+
      '<div class="od-capture-foot"><span id="odCapturePreview">支持「明天 15:00 整理方案 45分钟 !高 #工作」</span><label><input id="odParse" type="checkbox" '+(OD.captureParsed?'checked':'')+'> 识别时间</label><button data-od="capture-note">记为便签</button></div></section>';
  }
  function odToday(){
    var rows=odLiveRows(),active=rows.filter(odActive),ds=OD.day,real=dstr(today());
    var planned=odSort(rows.filter(function(t){return odOnDay(t,ds);})),overdue=odSort(active.filter(function(t){var d=dayOf(t['计划截止时间']);return d&&d<ds;}));
    var inbox=active.filter(function(t){return !t['计划开始时间']&&!t['计划截止时间'];});
    var completed=rows.filter(function(t){return t['任务状态']==='完成'&&odRealDay(t['状态开始时间'])===ds;});
    var pins=odPins().map(byId).filter(function(t){return t&&!t['回收站'];});
    var start=addDays(dparse(ds),-((dparse(ds).getDay()+6)%7)),week='';
    for(var i=0;i<7;i++){var d=addDays(start,i),dd=dstr(d);var count=active.filter(function(t){return odOnDay(t,dd);}).length;
      week+='<button data-od-day="'+dd+'" class="'+(dd===ds?'selected ':'')+(dd===real?'is-today':'')+'"><span>周'+'日一二三四五六'[d.getDay()]+'</span><b>'+d.getDate()+'</b><i class="'+(count?'has-tasks':'')+'"></i></button>';}
    var h='<div class="od-page" id="odToday"><header class="od-page-heading"><div><div class="od-eyebrow">ONE DAY AT A TIME <span>／</span> '+esc(odDateLabel(ds))+'</div><h1>'+(ds===real?'今天，做少一点。<em>做好一点。</em>':'这一天，值得认真安排。')+'</h1><p>不用把一切都完成，先让重要的事情向前一步。</p></div><button class="od-round" data-od="today" aria-label="回到今天">'+odIcon('sun',23)+'</button></header>'+
      '<div class="od-home-grid"><div class="od-home-main">'+odCaptureBox()+
      '<div class="od-week">'+week+'</div>'+
      '<section class="od-priorities"><div class="od-section-title"><div><span class="od-eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h2>今天最重要的三件事</h2></div><span class="od-count">'+pins.filter(odActive).length+' / 3</span></div><div class="od-priority-grid">';
    for(var j=0;j<3;j++){var t=pins[j];h+=t?'<article class="od-priority-card '+(!odActive(t)?'done':'')+'"><div><span class="od-card-no">0'+(j+1)+'</span><button data-od-pin="'+esc(rid(t))+'" aria-label="移出当日重点">×</button></div><button class="od-priority-title" data-open="'+esc(rid(t))+'">'+esc(t['任务标题'])+'</button><footer><span>'+esc(stMeta(t['任务状态']).s)+'</span><button data-od-focus="'+esc(rid(t))+'">'+odIcon('arrow',17)+'<span>专注这件事</span></button></footer></article>':
      '<button class="od-priority-empty" data-od="pick-pin"><span>0'+(j+1)+'</span>'+odIcon('plus',23)+'<b>留给一件重要的事</b></button>';}
    h+='</div></section><section class="od-panel od-task-panel"><div class="od-section-title"><h2>当日安排 <span class="od-small">'+planned.length+'</span></h2><button class="od-text-button" data-od="agenda">查看时间线 '+odIcon('arrow',15)+'</button></div>'+
      (planned.length?planned.map(function(t){return odRow(t);}).join(''):odEmpty('今天还有很多留白','安排一件事就好，其余的慢慢来。','<button class="od-text-button" data-od="inbox">从收集箱挑一件 '+odIcon('arrow',15)+'</button>'))+'</section>';
    if(overdue.length)h+='<section class="od-panel od-carry"><div class="od-section-title"><h2>还在等你处理 <span class="od-small">'+overdue.length+'</span></h2><span class="od-muted">重新安排，比自责有用</span></div>'+overdue.slice(0,5).map(function(t){return odRow(t);}).join('')+(overdue.length>5?'<button data-od="overdue" class="od-text-button">查看全部 '+overdue.length+' 项</button>':'')+'</section>';
    h+='</div><aside class="od-home-aside"><section class="od-today-summary"><div class="od-eyebrow">一点一点，都是进展</div><div class="od-summary-values"><div><strong>'+completed.length+'</strong><span>当日完成</span></div><div><strong>'+planned.filter(odActive).length+'</strong><span>还待完成</span></div><button data-od="inbox"><strong>'+inbox.length+'</strong><span>等待安排 '+odIcon('arrow',13)+'</span></button></div></section>'+odFocusPanel()+odCapacity(planned,ds)+odRecentNotes()+'</aside></div><footer class="od-page-footer">让工具记住琐事，把注意力还给自己。<span>OneDay / v10</span></footer></div>';
    $('viewHost').innerHTML=h;odCapturePreview();
  }
  function odCapacity(rows,ds){
    var blocks=rows.filter(function(t){return odActive(t)&&dayOf(t['计划开始时间'])===ds&&dayOf(t['计划截止时间'])===ds&&!(odTime(t['计划开始时间'])==='00:00'&&odTime(t['计划截止时间'])==='23:59');}).map(function(t){return [odMinutes(t['计划开始时间']),odMinutes(t['计划截止时间'])];});
    var stat=OneDayCore.intervalStats(blocks,0,1440),busy=Math.round(stat.busy);
    return '<section class="od-panel od-capacity"><div class="od-section-title"><h3>时间，不必排满</h3>'+odIcon('clock',17)+'</div><div class="od-capacity-number">'+(busy?(busy/60).toFixed(1):'0')+'<span>小时明确安排</span></div><div class="od-capacity-bar"><i style="width:'+Math.min(100,busy/480*100)+'%"></i></div><p>'+ (stat.overlap?'有 '+Math.round(stat.overlap)+' 分钟重叠，请检查时间线。':busy>480?'超过 8 小时，试着为自己留一点余地。':'留白也是计划的一部分。')+'</p><small>只统计当日有起止时间的任务；排除全天和跨日任务。刻度参考 8 小时，不是工作时长。</small></section>';
  }
  function odRecentNotes(){var notes=notesSorted().filter(function(n){return n['便签状态']!=='已归档';}).slice(0,3);
    return '<section class="od-panel od-recent"><div class="od-section-title"><h3>随手留下的想法</h3><button data-tab="note" aria-label="所有便签">'+odIcon('arrow',18)+'</button></div>'+ (notes.length?notes.map(function(n){return '<button data-od-note="'+esc(rid(n))+'"><span>'+esc((n['便签内容']||'').replace(/[#*`]/g,'').slice(0,90))+'</span><small>'+esc(n['便签分类']||'记录')+' · '+esc(fmtDay(n['创建时间']))+'</small></button>';}).join(''):'<p class="od-muted">灵感不一定要变成任务。<br>随手记一句，留给以后的自己。</p>')+'</section>';
  }
  function odCaptureValue(){
    var el=$('odCapture');OD.capture=el?el.value:OD.capture;var raw=(OD.capture||'').trim();
    var p=OneDayCore.parseCapture(raw,dstr(today()));
    if(!OD.captureParsed)p={title:raw,date:'',start:'',end:'',endDate:'',priority:'',tags:[],warnings:[],error:raw?'':'请写下任务标题'};
    return p;
  }
  function odCapturePreview(){var el=$('odCapturePreview');if(!el)return;var p=odCaptureValue();
    if(!OD.capture.trim()){el.textContent='试试：明天 15:00 整理方案 45分钟 !高 #工作';el.className='';return;}
    el.className=p.error?'bad':'';el.textContent=p.error||('将创建「'+p.title+'」 · '+(p.date?p.date+(p.start?' '+p.start+'–'+p.end:' · 全天'):'收集箱 · 不设时间')+(p.priority?' · '+p.priority+'优先级':'')+(p.tags.length?' · #'+p.tags.join(' #'):'')+(p.warnings.length?' · '+p.warnings.join('；'):''));
  }
  function odCreateCapture(asNote){
    if(OD.busyCapture)return;var p=odCaptureValue();if(!OD.capture.trim()){toast('先写一点内容');return;}if(!asNote&&p.error){toast(p.error);return;}
    OD.busyCapture=true;if($('odCaptureSubmit'))$('odCaptureSubmit').disabled=true;
    var raw=OD.capture,props,method;
    if(asNote){props={'便签内容':{text:raw},'便签分类':{select:'灵感'},'便签状态':{select:'未处理'},'置顶':{checkbox:false},'来源':{text:'OneDay 快速记录'},'创建时间':{date:nowISO()},'更新时间':{date:nowISO()}};method=addNote;}
    else{props={'任务标题':{text:p.title},'任务类型':{select:'主任务'},'任务状态':{select:ST_DEFAULT},'创建时间':{date:nowISO()},'状态开始时间':{date:nowISO()},'任务详情':{text:''},'回收站':{checkbox:false}};
      if(p.date){props['计划开始时间']={date:p.date+'T'+(p.start||'00:00')+':00Z'};props['计划截止时间']={date:(p.endDate||p.date)+'T'+(p.end||'23:59')+':00Z'};}
      if(p.priority)props['优先级']={select:p.priority};method=addTask;
    }
    method(props,function(err,r){
      OD.busyCapture=false;if($('odCaptureSubmit'))$('odCaptureSubmit').disabled=false;if(err)return;
      OD.capture='';odRemove('capture');if($('odCapture'))$('odCapture').value='';
      if(!asNote&&p.tags.length){odAttachCaptureTags(rid(r),p.title,p.tags,function(){toast('已收下，标签写入状态请留意提示');reload();});}
      else{toast(asNote?'已留下这条想法':'已收下，安心做眼前的事');reload();}
    });
  }
  function odAttachCaptureTags(id,title,names,done){var i=0;
    function next(){if(i===names.length){done();return;}var name=names[i++];
      function link(){addLink({'关联标题':{text:title+' / '+name},'任务ID':{text:id},'任务标题':{text:title},'标签名称':{text:name},'创建时间':{date:nowISO()}},function(err){if(err){toast('任务已创建，但标签关联失败：'+name,5000);done();return;}next();});}
      if(findTag(name)){link();}else{addTag({'标签名称':{text:name},'标签分类':{select:'其他'},'标签颜色':{select:'青'},'创建时间':{date:nowISO()}},function(err,r){if(err){toast('任务已创建，但标签创建失败',5000);done();return;}S.tags.push({_id:rid(r),'标签名称':name,'标签颜色':'青'});link();});}}
    next();
  }
  function odList(){var inbox=S.view==='inbox';
    $('viewHost').innerHTML='<div class="od-page od-list-page"><header class="od-page-heading"><div><div class="od-eyebrow">'+(inbox?'CAPTURE FIRST. ORGANIZE LATER.':'EVERYTHING, IN ITS PLACE.')+'</div><h1>'+(inbox?'先放下，再慢慢安排。':'所有事情，都在这里。')+'</h1><p>'+(inbox?'没有时间安排的未完成任务。先收集，等有余裕时再做决定。':'按状态、优先级和标签整理，不必在菜单里翻找。')+'</p></div><button class="od-primary" data-od="new">'+odIcon('plus',17)+'新建</button></header>'+
      '<div class="od-list-toolbar"><div class="od-search-field">'+odIcon('search',18)+'<input id="odListSearch" aria-label="筛选任务" placeholder="搜索标题、正文或标签…" value="'+esc(OD.query)+'"></div>'+(!inbox?'<select id="odStatus" aria-label="任务状态"><option value="active">未完成</option><option value="all">所有状态</option><option value="done">已完成</option><option value="overdue">已逾期</option></select>':'')+
      '<select id="odPriority" aria-label="优先级"><option value="">所有优先级</option>'+['紧急','高','中','低'].map(function(v){return '<option>'+v+'</option>';}).join('')+'</select><select id="odTag" aria-label="标签"><option value="">所有标签</option>'+S.tags.map(function(t){return '<option>'+esc(t['标签名称'])+'</option>';}).join('')+'</select></div><section class="od-panel" id="odListResults"></section></div>';
    if($('odStatus'))$('odStatus').value=OD.status;$('odPriority').value=OD.priority;$('odTag').value=OD.tag;odListResults();
  }
  function odListResults(){var inbox=S.view==='inbox',q=OD.query.toLowerCase();var rows=odLiveRows().filter(function(t){
    if(inbox&&(!odActive(t)||t['计划开始时间']||t['计划截止时间']))return false;
    if(!inbox&&((OD.status==='active'&&!odActive(t))||(OD.status==='done'&&t['任务状态']!=='完成')||(OD.status==='overdue'&&!isOverdue(t))))return false;
    if(OD.priority&&t['优先级']!==OD.priority)return false;if(OD.tag&&tagsOf(rid(t)).indexOf(OD.tag)<0)return false;
    return !q||[t['任务标题'],t['任务详情'],t['任务描述'],tagsOf(rid(t)).join(' ')].join(' ').toLowerCase().indexOf(q)>=0;
  });
    $('odListResults').innerHTML='<div class="od-section-title"><h2>'+(inbox?'等待安排':'任务清单')+' <span class="od-small">'+rows.length+'</span></h2><span class="od-muted">'+(inbox?'点击时钟，安排到合适的一天':'按优先级与截止时间排序')+'</span></div>'+(rows.length?odSort(rows).map(function(t){return odRow(t);}).join(''):odEmpty(inbox?'收集箱清空了':'没有找到匹配的任务',inbox?'下一个想法出现时，随时记下来。':'调整筛选条件，或从一件小事开始。'));
  }
  function odPin(id){if(OD.pinsBusy)return;var p=odPins(),at=p.indexOf(id);if(at>=0)p.splice(at,1);else{if(p.length>=3){toast('每天只选三件重点，先移出一件再加入。');return;}p.push(id);}
    OD.pinsBusy=true;odSet('oneday.plan.'+OD.day,p,function(err){OD.pinsBusy=false;if(err)return;renderAll();});}
  function odSchedule(id){var t=byId(id);if(!t)return;var ds=dayOf(t['计划开始时间'])||dstr(today());
    var m=layerDialog('为这件事安排时间','w620','<div class="od-schedule"><h3>'+esc(t['任务标题'])+'</h3><p class="od-muted">只调整计划，不改变任务状态或正文。</p><div class="od-schedule-days"><button data-od-arrange="today">今天</button><button data-od-arrange="tomorrow">明天</button><button data-od-arrange="nextweek">下周一</button></div><label>日期<input id="odPlanDate" type="date" value="'+ds+'"></label><div class="od-form-row"><label>开始时间（选填）<input id="odPlanTime" type="time" value="'+((odTime(t['计划开始时间'])!=='00:00')?odTime(t['计划开始时间']):'')+'"></label><label>时长（分钟）<input id="odPlanDuration" type="number" min="1" max="1440" value="30"></label></div></div>', '<button class="od-secondary" data-close="1">取消</button><button class="od-primary" id="odPlanSave">保存安排</button>');
    m.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var key=b.getAttribute('data-od-arrange');if(key){var d=today();if(key==='tomorrow')d=addDays(d,1);if(key==='nextweek')d=addDays(d,7-((d.getDay()+6)%7));$('odPlanDate').value=dstr(d);}
      if(b.id==='odPlanSave'){
        var date=$('odPlanDate').value,time=$('odPlanTime').value,dur=+$('odPlanDuration').value;
        if(!OneDayCore.validDate(date)||dur<1||dur>1440||!Number.isInteger(dur)){toast('请填写有效日期和 1–1440 分钟时长');return;}
        var p=OneDayCore.parseCapture(date+(time?' '+time+' '+dur+'分钟':'')+' 安排',date);
        var patch={'计划开始时间':{date:date+'T'+(p.start||'00:00')+':00Z'},'计划截止时间':{date:(p.endDate||date)+'T'+(p.end||'23:59')+':00Z'}};
        b.disabled=true;odGuardedPatch(id,patch,t,function(err){b.disabled=false;if(err)return;m.__close();toast('时间已安排');reload();});
      }
    });
  }
  function odSearch(mode){
    var mask=layerDialog(mode==='pin'?'选一件值得认真对待的事':'搜索与快捷操作','w620','<div class="od-command"><div class="od-command-input">'+odIcon('search',21)+'<input id="odSearchInput" autocomplete="off" placeholder="搜索任务、便签…" aria-label="搜索任务或便签"><kbd>ESC</kbd></div><div id="odSearchResults"></div></div>','<span class="od-muted">↑ ↓ 选择 · Enter 打开 · Esc 关闭</span>');
    var input=$('odSearchInput'),results=$('odSearchResults');var index=-1;
    function paint(){var q=input.value.trim().toLowerCase(),tasks=odLiveRows().filter(function(t){return (mode!=='pin'||odActive(t))&&[t['任务标题'],t['任务详情'],tagsOf(rid(t)).join(' ')].join(' ').toLowerCase().indexOf(q)>=0;}).slice(0,12);
      var notes=mode==='pin'?[]:S.notes.filter(function(n){return (n['便签内容']||'').toLowerCase().indexOf(q)>=0;}).slice(0,6);
      results.innerHTML=(!q&&mode!=='pin'?'<div class="od-command-actions"><button data-od="new">'+odIcon('plus',16)+' 新建任务</button><button data-od="data">'+odIcon('inbox',16)+' 数据与备份</button></div>':'')+
        (tasks.length?'<h4>任务</h4>':'')+tasks.map(function(t){return '<button class="od-result" '+(mode==='pin'?'data-pick-pin':'data-open')+'="'+esc(rid(t))+'">'+odIcon('task',18)+'<span>'+esc(t['任务标题'])+'</span><small>'+esc(stMeta(t['任务状态']).s)+'</small></button>';}).join('')+
        (notes.length?'<h4>便签</h4>':'')+notes.map(function(n){return '<button class="od-result" data-od-note="'+esc(rid(n))+'">'+odIcon('note',18)+'<span>'+esc((n['便签内容']||'').slice(0,90))+'</span></button>';}).join('')+(!tasks.length&&!notes.length?odEmpty('没有匹配结果','换一个关键词试试。'):'');index=-1;
    }
    input.addEventListener('input',paint);mask.addEventListener('keydown',function(e){var bs=results.querySelectorAll('button');if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();index=Math.max(0,Math.min(bs.length-1,index+(e.key==='ArrowDown'?1:-1)));bs.forEach(function(b,i){b.classList.toggle('selected',i===index);});if(bs[index])bs[index].scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&bs.length){e.preventDefault();bs[Math.max(0,index)].click();}});
    mask.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var id=b.getAttribute('data-pick-pin');if(id){mask.__close();odPin(id);}else if(b.hasAttribute('data-open')||b.hasAttribute('data-od-note')){mask.__close();}});
    paint();setTimeout(function(){input.focus();},50);
  }
  function odShowNote(id){var n=S.notes.filter(function(n){return rid(n)===id;})[0];if(!n)return;
    var m=layerDialog('一条记录','w620','<div class="od-note-detail"><div class="od-eyebrow">'+esc(n['便签分类']||'记录')+' · '+esc(fmtDT(n['创建时间']))+'</div><div class="md-view">'+mdToHtml(n['便签内容']||'')+'</div></div>','<button class="od-secondary" id="odEditNote">编辑便签</button>');
    m.querySelector('#odEditNote').onclick=function(){m.__close();odEditNote(n);};
  }
  function odEditNote(n){
    var m=layerDialog('编辑便签','w620','<p class="od-muted">支持 Markdown。保存后在任务或便签页查看。</p><textarea id="odNoteEditor" class="od-note-edit" aria-label="便签内容">'+esc(n['便签内容']||'')+'</textarea>','<button class="od-secondary" data-close="1">取消</button><button id="odNoteSave" class="od-primary">保存便签</button>');
    m.querySelector('#odNoteSave').onclick=function(){var text=m.querySelector('#odNoteEditor').value.trim(),b=this;if(!text){toast('便签内容不能为空');return;}b.disabled=true;
      updNote(rid(n),{'便签内容':{text:text},'更新时间':{date:nowISO()}},function(err){b.disabled=false;if(err)return;m.__close();toast('便签已保存');reload();});};
  }
  function odFocusPanel(){var f=OD.focus,active=odLiveRows().filter(odActive),selected=f&&f.taskId||'';
    return '<section class="od-focus"><div class="od-section-title"><span class="od-eyebrow">FOCUS / 此刻，只做一件事</span>'+odIcon('leaf',19)+'</div><div class="od-focus-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle class="track" cx="90" cy="90" r="80"/><circle class="progress" id="odFocusArc" cx="90" cy="90" r="80"/></svg><div><strong id="odFocusClock">25:00</strong><span id="odFocusLabel">给自己一段不被打扰的时间</span></div></div>'+
      '<select id="odFocusTask" aria-label="关联专注任务" '+(f&&f.running?'disabled':'')+'><option value="">不关联任务 · 自由专注</option>'+active.map(function(t){return '<option value="'+esc(rid(t))+'" '+(rid(t)===selected?'selected':'')+'>'+esc(t['任务标题'])+'</option>';}).join('')+'</select><div class="od-focus-durations">'+[25,45,60].map(function(v){return '<button data-od-duration="'+v+'" class="'+((f?f.duration/60:25)===v?'on':'')+'">'+v+' 分钟</button>';}).join('')+'</div><div class="od-focus-buttons"><button data-od="focus-reset" class="od-focus-reset" aria-label="重置计时器">↻</button><button data-od="focus-toggle" class="od-primary">开始专注</button></div><button id="odFocusSave" class="od-focus-save" data-od="focus-save" hidden>记录这段专注</button><small>本机计时；关闭页面后不保证声音或系统通知。<br>计时结束后，由你确认写入一条记录。</small></section>';
  }
  function odFocusPaint(){var clock=$('odFocusClock');if(!clock)return;var f=OD.focus,left=f?OneDayCore.remaining(f,Date.now()):1500;
    if(f&&f.running&&left<=0){f.remaining=0;f.running=false;f.finished=true;odStore('focus',f);toast('这段专注结束了，停下来喘口气。',5000);}
    var secs=Math.ceil(left);clock.textContent=pad(Math.floor(secs/60))+':'+pad(secs%60);
    $('odFocusLabel').textContent=f&&f.finished?'做到了。给这一刻留个记录。':f&&f.running?'保持节奏，先把这一件做好':f&&f.started?'暂停一下，也没关系':'给自己一段不被打扰的时间';
    var arc=$('odFocusArc');if(arc){arc.style.strokeDasharray='503';arc.style.strokeDashoffset=String(503*(1-left/(f?f.duration:1500)));}
    var toggle=document.querySelector('[data-od="focus-toggle"]');if(toggle)toggle.textContent=f&&f.finished?'再来一段':f&&f.running?'暂停专注':f&&f.started?'继续专注':'开始专注';
    if($('odFocusTask'))$('odFocusTask').disabled=!!(f&&f.running);
    if($('odFocusSave')){$('odFocusSave').hidden=!(f&&f.finished&&!f.saved);$('odFocusSave').disabled=OD.focusSaved;}
  }
  function odFocusStart(id,minutes){if(OD.focus&&OD.focus.running&&!confirm('当前正在专注，确定结束计时并开始新的一段？未记录的计时将被替换。'))return;
    OD.focus={id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),duration:(minutes||25)*60,remaining:(minutes||25)*60,taskId:id||'',running:false,started:false,startedAt:0};odStore('focus',OD.focus);}
  function odFocusToggle(){var f=OD.focus;if(!f||f.finished){odFocusStart($('odFocusTask')?$('odFocusTask').value:'',f?f.duration/60:25);f=OD.focus;}
    if(f.running){f.remaining=OneDayCore.remaining(f,Date.now());f.running=false;}else{f.startedAt=Date.now();f.running=true;f.started=true;if($('odFocusTask'))f.taskId=$('odFocusTask').value;}
    odStore('focus',f);odFocusPaint();}
  function odFocusSave(){var f=OD.focus;if(!f||!f.finished||f.saved||OD.focusSaved)return;var source='OneDay.focus/v10:'+f.id+':'+f.duration;
    if(S.notes.some(function(n){return n['来源']===source;})){f.saved=true;odStore('focus',f);odFocusPaint();return;}
    var t=byId(f.taskId),text='专注完成｜'+(t?t['任务标题']:'自由专注')+'\n\n计时 '+Math.round(f.duration/60)+' 分钟。\n\n完成于 '+new Date().toLocaleString('zh-CN')+'。';OD.focusSaved=true;odFocusPaint();
    addNote({'便签内容':{text:text},'便签分类':{select:'记录'},'便签状态':{select:'已归档'},'关联任务ID':{text:f.taskId||''},'关联任务标题':{text:t?t['任务标题']:''},'来源':{text:source},'创建时间':{date:nowISO()},'更新时间':{date:nowISO()}},function(err){OD.focusSaved=false;if(err){odFocusPaint();return;}f.saved=true;odStore('focus',f);toast('已留下这段专注记录');reload();});
  }
  function odReview(){var base=addDays(today(),OD.reviewOffset*7),start=addDays(base,-((base.getDay()+6)%7)),end=addDays(start,6),a=dstr(start),z=dstr(end),rows=odLiveRows();
    var done=rows.filter(function(t){var d=odRealDay(t['状态开始时间']);return t['任务状态']==='完成'&&d>=a&&d<=z;});
    var notes=S.notes.filter(function(n){var d=odRealDay(n['创建时间']);return d>=a&&d<=z;}),newTasks=rows.filter(function(t){var d=odRealDay(t['创建时间']);return d>=a&&d<=z;});
    var focusNotes=notes.filter(function(n){return /^OneDay\.focus\/v10:[^:]+:\d+$/.test(n['来源']||'');});
    var mins=focusNotes.reduce(function(sum,n){return sum+Number(n['来源'].split(':')[2])/60;},0),bars='',mx=1;
    var nums=[];for(var i=0;i<7;i++){var ds=dstr(addDays(start,i));nums.push(done.filter(function(t){return odRealDay(t['状态开始时间'])===ds;}).length);}mx=Math.max.apply(null,nums.concat([1]));
    for(var j=0;j<7;j++)bars+='<div class="od-bar"><b>'+nums[j]+'</b><div><i style="height:'+Math.max(3,nums[j]/mx*100)+'%"></i></div><span>周'+'一二三四五六日'[j]+'</span></div>';
    $('viewHost').innerHTML='<div class="od-page" id="odReview"><header class="od-page-heading"><div><div class="od-eyebrow">LOOK BACK, MOVE FORWARD</div><h1>走过的每一步，<em>都算数。</em></h1><p>回顾不是给自己打分，是找到下周更舒服的节奏。</p></div><div class="od-review-nav"><button data-od="review-prev" aria-label="上一周">‹</button><span>'+a+' — '+z+'</span><button data-od="review-next" aria-label="下一周">›</button></div></header><div class="od-review-stats">'+[[done.length,'本周完成任务'],[newTasks.length,'本周新收集'],[notes.length,'本周记录'],[Math.round(mins),'专注计时 · 分钟']].map(function(v){return '<div class="od-panel"><strong>'+v[0]+'</strong><span>'+v[1]+'</span></div>';}).join('')+'</div><div class="od-review-grid"><section class="od-panel"><div class="od-section-title"><h2>一点一点的进展</h2><span class="od-muted">完成任务 / 件</span></div><div class="od-bars" role="img" aria-label="周一至周日完成数量：'+nums.join('、')+'">'+bars+'</div><p class="od-footnote">完成数：当前处于完成状态、且最近进入完成状态在本周的任务，含子任务；已重新打开的任务不计入。专注来自已确认写入的计时记录，不等同于真实工作时长。</p></section><section class="od-reflection"><div class="od-eyebrow">A NOTE TO MYSELF</div><h2>给下周的自己，留一句话。</h2><p>什么值得继续？<br>什么可以放下？<br>下一步，最小的行动是什么？</p><textarea id="odReflection" rows="4" placeholder="不必写成报告。一句真实的感受就够了。" aria-label="本周回顾内容">'+esc(odRead('reflection.'+a,''))+'</textarea><button class="od-primary" data-od="review-note" data-week="'+a+'">保存为回顾便签 '+odIcon('arrow',17)+'</button></section></div><section class="od-panel od-review-done"><div class="od-section-title"><h2>这周，你完成了这些</h2><button class="od-text-button" data-od="legacy-report">原版详细周报 '+odIcon('arrow',15)+'</button></div>'+(done.length?odSort(done).map(function(t){return odRow(t);}).join(''):odEmpty('这里还没有完成记录','做了但没记录的努力，同样有价值。'))+'</section></div>';
  }
  function odReflect(week,button){var el=$('odReflection'),text=el.value.trim();if(!text){toast('先给自己写一句话');return;}button.disabled=true;
    addNote({'便签内容':{text:'# 一周回顾 · '+week+'\n\n'+text},'便签分类':{select:'记录'},'便签状态':{select:'未处理'},'来源':{text:'OneDay.review/v10'},'创建时间':{date:nowISO()},'更新时间':{date:nowISO()}},function(err){button.disabled=false;if(err)return;odRemove('reflection.'+week);el.value='';toast('已保存到便签');reload();});
  }
  function odDownload(name,text,type){var url=URL.createObjectURL(new Blob([text],{type:type||'text/plain;charset=utf-8'}));var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},20000);}
  function odBackup(){return {format:'oneday-full-backup',version:10,exportedAt:nowISO(),mode:odMode(),sourceIds:{tasks:'oneday-tasks',logs:'oneday-logs',tags:'oneday-tags',links:'oneday-links',notes:'oneday-notes',sets:'oneday-sets',cal:'oneday-cal'},tables:{tasks:S.tasks,logs:S.logs,tags:S.tags,links:S.links,notes:S.notes,sets:S.sets,cal:S.cal}};}
  function odData(){toggleMenu(false);var keys=['tasks','logs','tags','links','notes','sets','cal'],names=['任务','状态日志','标签','任务标签关联','便签','设置','日历标记'];
    var h='<div id="odDataCenter"><div class="od-data-intro"><div class="od-eyebrow">YOUR DATA, YOUR CONTROL</div><h2>'+esc(odMode())+'</h2><p>HTML 是应用入口，真正的数据读写依赖页面内的 WorkBuddy 数据表 SDK。共享 HTML，不代表共享了数据库写入权限。</p></div><div class="od-data-grid">'+keys.map(function(k,i){return '<div><strong>'+S[k].length+'</strong><span>'+names[i]+'</span></div>';}).join('')+'</div><div class="od-health"><p>上次完整读取：<b>'+ (OD.lastRead?new Date(OD.lastRead).toLocaleString('zh-CN'):'尚未成功读取')+'</b></p><p>待写入：'+OD.pending+' 项 · 本地存储：'+(OD.storageWarn?'不可用 / 容量不足':'未发现写入错误（依赖浏览器权限）')+'</p><p>当前问题：'+esc(OD.readError||OD.writeError||'未发现请求错误')+'</p></div><div class="od-section-title"><h3>给数据留一条退路</h3></div><div class="od-data-actions"><button class="od-primary" data-od="export-json">完整 JSON 备份</button><button class="od-secondary" data-od="export-tasks">导出任务 CSV</button><button class="od-secondary" data-od="export-notes">导出便签 CSV</button><button class="od-secondary" data-od="import-csv">从 CSV 追加任务</button><button class="od-secondary" data-od="export-drafts">导出本机未提交草稿</button>'+(window.__ONEDAY_LOCAL__?'<button class="od-secondary" data-od="restore-local">从 JSON 恢复本机体验数据</button>':'')+'</div><p class="od-footnote">JSON 包含七张表的当前已读取快照和记录 ID，适合保留完整字段；若读取失败，它可能不是最新云端状态。CSV 面向查看和交换，对公式开头的文本加了保护前缀。导入只追加，不覆盖已有任务，不恢复关联日志。</p><div class="od-data-warning"><strong>关于跨设备与安全</strong><p>手机和 PC 必须打开同一页面、获得同一数据空间权限。页面可打开 ≠ 数据可读写。请使用私有或登录后共享，勿公开个人记录。V10 不内置账号令牌。</p><p>已加入单设备写入排队、详情的逐字段冲突检查和本机草稿，但原 SDK 没有提供事务或原子版本锁，因此不能保证两台设备同时修改同一字段绝不冲突。建议一端修改完成、另一端刷新后再改。</p><p>草稿和计时器仅留在当前浏览器。清理浏览器数据会删除它们；未提交草稿不会自动上传。</p></div><details><summary>请求错误记录（本次打开期间）</summary><pre>'+esc(JSON.stringify(OD.history,null,2))+'</pre></details></div>';
    layerDialog('数据、备份与连接','w900',h,'<button class="od-secondary" data-od="refresh">重新读取七张表</button><button class="od-primary" data-close="1">完成</button>');
  }
  function odExportCSV(kind){var fields=kind==='notes'?['便签内容','便签分类','便签状态','关联任务ID','创建时间','更新时间','来源']:['任务标题','任务状态','任务类型','父任务ID','优先级','计划开始时间','计划截止时间','任务详情','创建时间','回收站'];var rows=[['_id'].concat(fields)];S[kind].forEach(function(r){rows.push([rid(r)].concat(fields.map(function(k){return r[k]==null?'':r[k];})));});odDownload('OneDay-'+kind+'-'+dstr(today())+'.csv',OneDayCore.csv(rows,true),'text/csv;charset=utf-8');}
  function odPickFile(accept,fn){var f=document.createElement('input');f.type='file';f.accept=accept;f.onchange=function(){var file=f.files[0];if(!file)return;if(file.size>10*1024*1024){toast('请选择 10MB 以内的文件');return;}file.text().then(function(s){fn(s,file);},function(){toast('读取文件失败');});};f.click();}
  function odImport(){odPickFile('.csv,text/csv',function(text){var rows;try{rows=OneDayCore.parseCSV(text);}catch(e){toast('CSV 解析失败：'+e.message,5000);return;}
    if(rows.length<2||rows.length>501){toast('CSV 需要表头和 1–500 条数据');return;}var headers=rows.shift(),col=headers.indexOf('任务标题');if(col<0){toast('表头需要有「任务标题」列；可以使用本应用导出的 CSV');return;}
    var list=[],errors=[];rows.forEach(function(row,i){if(row.every(function(v){return !v.trim();}))return;var title=(row[col]||'').trim();if(!title||title.length>300){errors.push('第 '+(i+2)+' 行：标题为空或超过 300 字');return;}
      function v(k){var ix=headers.indexOf(k);return ix<0?'':(row[ix]||'');}
      var priority=v('优先级'),a=v('计划开始时间'),b=v('计划截止时间');
      if(priority&&['紧急','高','中','低'].indexOf(priority)<0){errors.push('第 '+(i+2)+' 行：优先级无效');return;}
      function validTime(x){return !x||(/^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z?)?$/.test(x)&&OneDayCore.validDate(x.slice(0,10))&&(!x.includes('T')||(+x.slice(11,13)<24&&+x.slice(14,16)<60)));}
      if(!validTime(a)||!validTime(b)||(a&&b&&b<a)){errors.push('第 '+(i+2)+' 行：计划时间无效');return;}
      list.push({title:title,priority:priority,start:a,end:b,detail:v('任务详情')});
    });
    if(errors.length){layerDialog('请先修正 CSV','w620','<p>没有写入任何数据。</p><pre>'+esc(errors.slice(0,30).join('\n'))+'</pre>','<button class="od-primary" data-close="1">关闭</button>');return;}
    var m=layerDialog('确认追加任务','w900','<div class="od-import-preview"><p>将逐条创建 <b>'+list.length+'</b> 项主任务，状态统一为「收集」。忽略原 ID、回收站、父子关联与日志，不覆盖已有记录。</p><label><input id="odSkipDuplicate" type="checkbox" checked> 跳过与现有任务标题和起止时间完全相同的记录</label><div class="od-table-wrap"><table><thead><tr><th>标题</th><th>开始</th><th>截止</th><th>优先级</th></tr></thead><tbody>'+list.slice(0,8).map(function(r){return '<tr><td>'+esc(r.title)+'</td><td>'+esc(r.start||'未安排')+'</td><td>'+esc(r.end||'未安排')+'</td><td>'+esc(r.priority)+'</td></tr>';}).join('')+'</tbody></table></div><p id="odImportStatus">预览前 8 项。请先导出 JSON 备份。</p></div>','<button class="od-secondary" data-close="1">取消</button><button id="odImportConfirm" class="od-primary">确认追加</button>');
    m.querySelector('#odImportConfirm').onclick=function(){var button=this;button.disabled=true;var status=m.querySelector('#odImportStatus'),skip=m.querySelector('#odSkipDuplicate').checked,i=0,created=0,skipped=0,known=S.tasks.slice(),receipts=[];
      function step(){if(i===list.length){status.textContent='完成：新增 '+created+' 项，跳过 '+skipped+' 项。';reload();return;}var r=list[i++];
        var a=r.start?(r.start.length===10?r.start+'T00:00:00Z':r.start.endsWith('Z')?r.start:r.start+'Z'):'',b=r.end?(r.end.length===10?r.end+'T23:59:00Z':r.end.endsWith('Z')?r.end:r.end+'Z'):'';
        if(skip&&known.some(function(t){return t['任务标题']===r.title&&(t['计划开始时间']||'')===a&&(t['计划截止时间']||'')===b;})){skipped++;step();return;}
        var p={'任务标题':{text:r.title},'任务类型':{select:'主任务'},'任务状态':{select:ST_DEFAULT},'任务详情':{text:r.detail},'创建时间':{date:nowISO()},'状态开始时间':{date:nowISO()}};if(a)p['计划开始时间']={date:a};if(b)p['计划截止时间']={date:b};if(r.priority)p['优先级']={select:r.priority};
        addTask(p,function(err,result){if(err){status.textContent='已停止：成功 '+created+' 项；当前第 '+i+' 项结果可能不确定。请重新读取并核对后再导入，未自动重试。';odStore('lastImport',{at:nowISO(),receipts:receipts,stoppedAt:i});reload();return;}created++;receipts.push({id:rid(result),title:r.title});known.push({'任务标题':r.title,'计划开始时间':a,'计划截止时间':b});status.textContent='已写入 '+created+' 项…';step();});
      }step();
    };
  });}
  function odRestoreLocal(){if(!window.__onedayRestore){toast('云端页面不支持覆盖式恢复，请按交接文档操作');return;}odPickFile('.json,application/json',function(text){try{var data=JSON.parse(text);if(data.format!=='oneday-full-backup'||!data.tables)throw new Error('不是 OneDay 完整备份');var keys=['tasks','logs','tags','links','notes','sets','cal'];keys.forEach(function(k){if(!Array.isArray(data.tables[k]))throw new Error('缺少数据表 '+k);data.tables[k].forEach(function(r){if(!r||typeof r!=='object'||!rid(r))throw new Error('记录缺少 ID');});});if(!confirm('将替换本机体验数据，不修改 WorkBuddy 云端。建议先导出当前 JSON。继续？'))return;window.__onedayRestore(data);reload();toast('本机体验数据已恢复');}catch(e){toast('恢复失败：'+e.message,6000);}});}
  function odExportDrafts(){var data={exportedAt:nowISO(),capture:odRead('capture',''),taskDrafts:[]};S.tasks.forEach(function(t){var d=odRead('draft.'+rid(t),null);if(d)data.taskDrafts.push({id:rid(t),draft:d});});odDownload('OneDay-未提交草稿-'+dstr(today())+'.json',JSON.stringify(data,null,2),'application/json');}

  document.addEventListener('input',function(e){var id=e.target.id;
    if(id==='odCapture'){OD.capture=e.target.value;odStore('capture',OD.capture);odCapturePreview();}
    if(id==='odListSearch'){OD.query=e.target.value;odListResults();}
    if(id==='odReflection'){var b=document.querySelector('[data-od="review-note"]');if(b)odStore('reflection.'+b.getAttribute('data-week'),e.target.value);}
  });
  document.addEventListener('change',function(e){var id=e.target.id;
    if(id==='odParse'){OD.captureParsed=e.target.checked;odCapturePreview();}
    if(id==='odStatus'||id==='odPriority'||id==='odTag'){OD.status=$('odStatus')?$('odStatus').value:OD.status;OD.priority=$('odPriority').value;OD.tag=$('odTag').value;odListResults();}
    if(id==='odFocusTask'&&OD.focus&&!OD.focus.running){OD.focus.taskId=e.target.value;odStore('focus',OD.focus);}
  });
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(!b)return;
    var id=b.getAttribute('data-od-check');if(id){var t=byId(id);switchStatus(id,t&&odActive(t)?'完成':'进行中',function(err){if(!err){toast(t&&odActive(t)?'已重新开始':'已完成，做得不错');reload();}});return;}
    id=b.getAttribute('data-od-pin');if(id){odPin(id);return;}
    id=b.getAttribute('data-od-schedule');if(id){odSchedule(id);return;}
    id=b.getAttribute('data-od-day');if(id){OD.day=id;renderAll();return;}
    id=b.getAttribute('data-od-note');if(id){odShowNote(id);return;}
    id=b.getAttribute('data-od-focus');if(id){odFocusStart(id,25);S.tab='today';renderAll();var f=$('odFocusTask');if(f)f.value=id;odFocusToggle();if(document.querySelector('.od-focus'))document.querySelector('.od-focus').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
    id=b.getAttribute('data-od-duration');if(id){var selected=$('odFocusTask')?$('odFocusTask').value:'';odFocusStart(selected,+id);renderAll();return;}
    var a=b.getAttribute('data-od');if(!a)return;
    if(a==='new'){openCreate({kind:S.tab==='note'?'note':'task'});return;}
    if(a==='capture'){odCreateCapture(false);return;}if(a==='capture-note'){odCreateCapture(true);return;}
    if(a==='search'){toggleMenu(false);odSearch();return;}if(a==='pick-pin'){odSearch('pin');return;}
    if(a==='today'){OD.day=dstr(today());renderAll();return;}
    if(a==='agenda'){openDayAgenda(OD.day);return;}
    if(a==='inbox'||a==='overdue'){S.tab='task';S.view=a==='inbox'?'inbox':'list';OD.status=a==='overdue'?'overdue':'active';OD.query='';renderAll();return;}
    if(a==='focus-toggle'){odFocusToggle();return;}
    if(a==='focus-reset'){if(OD.focus&&OD.focus.started&&!confirm('放弃本段未记录的计时并重置？'))return;var duration=OD.focus?OD.focus.duration/60:25;var task=OD.focus?OD.focus.taskId:'';OD.focus=null;odFocusStart(task,duration);odFocusPaint();return;}
    if(a==='focus-save'){odFocusSave();return;}
    if(a==='review-prev'||a==='review-next'){OD.reviewOffset+=(a==='review-prev'?-1:1);odReview();return;}
    if(a==='review-note'){odReflect(b.getAttribute('data-week'),b);return;}
    if(a==='legacy-report'){openReport();return;}
    if(a==='data'){odData();return;}
    if(a==='refresh'){reload(function(err){if(!err)toast('七张表已重新读取');});return;}
    if(a==='export-json'){odDownload('OneDay-完整备份-'+dstr(today())+'.json',JSON.stringify(odBackup(),null,2),'application/json');return;}
    if(a==='export-tasks'){odExportCSV('tasks');return;}if(a==='export-notes'){odExportCSV('notes');return;}
    if(a==='import-csv'){odImport();return;}if(a==='restore-local'){odRestoreLocal();return;}if(a==='export-drafts'){odExportDrafts();return;}
  });
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopImmediatePropagation();odSearch();return;}
    if(e.target.id==='odCapture'&&e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();odCreateCapture(e.shiftKey);return;}
    var masks=document.querySelectorAll('.mask'),mask=masks[masks.length-1];if(!mask)return;
    if(e.key==='Escape'){odFlush(mask);return;}
    if(e.key==='Tab'){var all=Array.prototype.filter.call(mask.querySelectorAll('button,input,textarea,select,a[href],[contenteditable="true"],[tabindex="0"]'),function(el){return !el.disabled&&el.getClientRects().length;});if(!all.length)return;var first=all[0],last=all[all.length-1];if(e.shiftKey&&(document.activeElement===first||!mask.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!mask.contains(document.activeElement))){e.preventDefault();first.focus();}}
  },true);
  window.addEventListener('beforeunload',function(e){odFlush($('modalRoot'));odFlush($('drawerRoot'));if(OD.pending){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',function(){if(document.hidden){odFlush($('modalRoot'));odFlush($('drawerRoot'));}else{odFocusPaint();if(dbReady&&Date.now()-OD.lastRead>30000&&!document.querySelector('.mask,.drawer'))reload();}});
  // One observer for accessible dialog metadata; no event listener is re-bound on every render.
  new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType!==1)return;var ds=n.matches('.dlg')?[n]:n.querySelectorAll('.dlg');Array.prototype.forEach.call(ds,function(d){d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');var h=d.querySelector('h3,.td-title');d.setAttribute('aria-label',h?(h.value||h.textContent):'OneDay 对话框');d.querySelectorAll('[data-close]').forEach(function(b){b.setAttribute('aria-label','关闭对话框');});});});});}).observe($('modalRoot'),{childList:true,subtree:true});
  setInterval(odFocusPaint,1000);
