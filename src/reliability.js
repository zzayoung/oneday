  /* v10 reliability. One local write queue; no server transaction/CAS is claimed. */
  var OD={reading:false,reloadAgain:false,waiters:[],hasSnapshot:false,lastRead:0,lastWrite:0,
    readError:'',writeError:'',pending:0,writeChain:Promise.resolve(),history:[],storageWarn:false,
    day:dstr(today()),query:'',status:'active',priority:'',tag:'',capture:'',captureParsed:true,
    busyCapture:false,focus:null,pinsBusy:false,focusSaved:false,reviewOffset:0};
  function odUnescape(s){var el=document.createElement('textarea');el.innerHTML=s;return el.value;}
  function odRead(key,fallback){try{var s=localStorage.getItem('oneday.v10.'+key);return s?JSON.parse(s):fallback;}catch(e){return fallback;}}
  function odStore(key,v){try{localStorage.setItem('oneday.v10.'+key,JSON.stringify(v));return true;}catch(e){
    if(!OD.storageWarn){OD.storageWarn=true;toast('浏览器未允许本地存储：草稿和计时器不能跨刷新保留，请及时保存或导出。',7000);}return false;}}
  function odRemove(key){try{localStorage.removeItem('oneday.v10.'+key);}catch(e){}}
  function odFlush(root){
    if(!root)return;
    if(root.__odFlush)root.__odFlush();
    Array.prototype.forEach.call(root.querySelectorAll('*'),function(el){if(el.__odFlush)el.__odFlush();});
  }
  function odWrite(run,cb){
    OD.pending++;odSyncPaint();
    var p=OD.writeChain.then(function(){if(!dbReady)throw new Error('当前不是可写的数据环境');return run();});
    OD.writeChain=p.catch(function(){});
    p.then(function(r){
      OD.pending--;OD.lastWrite=Date.now();OD.writeError='';odSyncPaint();if(cb)cb(null,r);
    },function(e){
      OD.pending--;OD.writeError='保存失败：'+describeErr(e);
      OD.history.unshift({time:nowISO(),message:OD.writeError});OD.history=OD.history.slice(0,20);
      odSyncPaint();toast(OD.writeError+'。未自动重试，请先核对。',6000);
      // v9 has many success-only callbacks. Do not execute those on failed writes.
      if(cb&&cb.length)cb(e);
    });
    return p;
  }
  function odGuardedPatch(id,props,base,cb){
    odWrite(function(){return new Promise(function(resolve,reject){
      qTasks(function(rows,err){
        if(err){reject(err);return;}
        var current=normIds(rows).filter(function(t){return rid(t)===id;})[0];
        if(!current){reject(new Error('任务已被其他设备删除，草稿仍保留在本机'));return;}
        if(current['回收站']){reject(new Error('任务已在回收站，先恢复再编辑'));return;}
        var conflicts=Object.keys(props).filter(function(k){return !OneDayCore.same(current[k],base[k])&&!OneDayCore.same(current[k],OneDayCore.value(props[k]));});
        if(conflicts.length){reject(new Error('其他设备已修改 '+conflicts.join('、')+'；请复制草稿、关闭详情并刷新核对'));return;}
        // Literal required by the supplied WorkBuddy import checker. Narrow patch preserves unrelated fields.
        db.updateRecord({databaseId:'oneday-tasks',recordId:id,properties:cleanProps(props,true)}).then(resolve,reject);
      });
    });},cb);
  }
  function odSet(key,value,cb){
    var row=S.sets.filter(function(r){return r['设置项']===key;})[0];
    var p={'设置值':{text:JSON.stringify(value)},'更新时间':{date:nowISO()}};
    if(row){updSet(rid(row),p,function(err){if(!err)row['设置值']=JSON.stringify(value);if(cb)cb(err);});}
    else{p['设置项']={text:key};addSet(p,function(err,r){if(!err)S.sets.push({_id:rid(r),'设置项':key,'设置值':JSON.stringify(value)});if(cb)cb(err);});}
  }
  function odGet(key,fallback){var rows=S.sets.filter(function(r){return r['设置项']===key;});
    if(!rows.length)return fallback;rows.sort(function(a,b){return String(b['更新时间']||'').localeCompare(String(a['更新时间']||''));});
    try{return JSON.parse(rows[0]['设置值']);}catch(e){return fallback;}}
  function odMode(){return window.__ONEDAY_LOCAL__?'本机体验 · 非云同步':(dbReady?'WorkBuddy 数据环境':'尚未连接资料库');}
  function odSyncPaint(){
    var badge=$('odSync');if(badge){badge.className='od-sync'+((OD.readError||OD.writeError)?' bad':'');
      badge.innerHTML='<i></i>'+esc(OD.pending?'正在保存 '+OD.pending+' 项':(OD.readError||OD.writeError)?'连接需检查':!dbReady?'未连接':window.__ONEDAY_LOCAL__?'本机体验 · 非云同步':OD.lastRead?'资料库已读取':'正在连接');
      badge.title=odMode()+' · '+(OD.lastWrite?'最近保存 '+new Date(OD.lastWrite).toLocaleTimeString():'尚未写入');}
    var banner=$('odNotice');if(banner){var err=window.__ONEDAY_LOCAL_ERROR__||OD.readError||OD.writeError;
      banner.hidden=!err&&!window.__ONEDAY_LOCAL__;
      banner.className='od-notice'+(err?' error':'');
      banner.innerHTML=err?'<span>'+esc(err)+'。'+(OD.hasSnapshot?'当前保留上次成功读取的数据。':'请检查登录、权限或网络。')+'</span><button data-od="refresh">重新读取</button><button data-od="data">检查 / 备份</button>':
        '<span>本机体验版：示例内容不会写入 WorkBuddy，也不会跨设备同步。</span><button data-od="data">数据说明</button>';}
  }
  function odLiveRows(){return S.tasks.filter(function(t){return !t['回收站'];});}
  function odActive(t){return !isTerminal(t['任务状态']||ST_DEFAULT);}
  function odPins(){var p=odGet('oneday.plan.'+OD.day,[]);return Array.isArray(p)?p.slice(0,3):[];}
  function odTime(s){return s?String(s).slice(11,16):'';}
  function odMinutes(s){var v=odTime(s).split(':');return v.length===2?+v[0]*60+(+v[1]):0;}
  function odOnDay(t,ds){var a=dayOf(t['计划开始时间']),b=dayOf(t['计划截止时间']);return (a&&b)?a<=ds&&b>=ds:((a||b)===ds);}
  function odSort(rows){return rows.slice().sort(function(a,b){
    var at=odActive(a)?0:1,bt=odActive(b)?0:1;if(at!==bt)return at-bt;
    var rank={'紧急':0,'高':1,'中':2,'低':3};var ap=rank[a['优先级']],bp=rank[b['优先级']];
    if(ap!==bp)return (ap==null?4:ap)-(bp==null?4:bp);
    return String(a['计划截止时间']||'9999').localeCompare(String(b['计划截止时间']||'9999'))||String(b['创建时间']||'').localeCompare(String(a['创建时间']||''));
  });}
  function odRestoreFocus(){OD.focus=odRead('focus',null);if(OD.focus&&(!OD.focus.duration||!isFinite(OD.focus.remaining)))OD.focus=null;}
  odRestoreFocus();
