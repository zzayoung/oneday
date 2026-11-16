/* OneDay v10 pure helpers. No DOM, no network, no third-party dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OneDayCore = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dateString(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return dateString(d) === s;
  }
  function plusDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dateString(d); }
  function safeURL(s, image) {
    s = String(s || '').trim();
    if (/[\u0000-\u0020\u007f]/.test(s)) return '';
    if (/^https?:\/\/[^/]+/i.test(s)) return s;
    if (!image && /^mailto:[^\s]+@[^\s]+$/i.test(s)) return s;
    if (image && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(s)) return s;
    return '';
  }
  function parseCapture(raw, base) {
    base = validDate(base || '') ? base : dateString(new Date());
    var text = String(raw || '').trim(), s = text, x = {title:'',date:'',start:'',end:'',endDate:'',priority:'',tags:[],minutes:0,warnings:[],error:'',raw:text};
    var m, recurring = /每(天|日|周|月|年|工作日)/.test(s);
    if (recurring) x.warnings.push('重复规则暂不自动生成；本次只创建一条任务。');
    s = s.replace(/(?:^|\s)[!！](紧急|高|中|低)(?=\s|$)/g,function(a,b){x.priority=b;return ' ';});
    s = s.replace(/(?:^|\s)#([^\s#]{1,30})/g,function(a,b){if(x.tags.indexOf(b)<0)x.tags.push(b);return ' ';});
    m = s.match(/\d{4}-\d{1,2}-\d{1,2}/);
    if (m) {
      var parts=m[0].split('-'), ds=parts[0]+'-'+pad(Number(parts[1]))+'-'+pad(Number(parts[2]));
      if (!validDate(ds)) x.error='日期不存在，请检查月份和天数。';
      else {x.date=ds;s=s.replace(m[0],' ');}
    } else if (/后天/.test(s)) {x.date=plusDays(base,2);s=s.replace('后天',' ');}
    else if (/明天/.test(s)) {x.date=plusDays(base,1);s=s.replace('明天',' ');}
    else if (/今天/.test(s)) {x.date=base;s=s.replace('今天',' ');}
    else if (!recurring && (m=s.match(/(下周|本周|周)([一二三四五六日天])/))) {
      var dow='一二三四五六日'.indexOf(m[2]==='天'?'日':m[2]), bd=new Date(base+'T12:00:00'), current=(bd.getDay()+6)%7;
      var step=dow-current;
      if(m[1]==='下周')step+=7;else if(m[1]==='周'&&step<0)step+=7;
      x.date=plusDays(base,step);s=s.replace(m[0],' ');
    }
    var duration=s.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(分钟|小时|mins?|min|m|hrs?|h)(?=\s|$)/i);
    if(duration){
      x.minutes=Math.round(Number(duration[1])*(/^(小时|h)/i.test(duration[2])?60:1));
      if(x.minutes<1||x.minutes>1440)x.error='时长需在 1 分钟到 24 小时之间。';
      s=s.replace(duration[0],' ');
    }
    var hh=null,mm=0;
    m=s.match(/(上午|早上|下午|晚上|中午)?\s*(\d{1,2})[:：](\d{2})/);
    if(m){hh=Number(m[2]);mm=Number(m[3]);if((m[1]==='下午'||m[1]==='晚上')&&hh<12)hh+=12;if(m[1]==='上午'&&hh===12)hh=0;s=s.replace(m[0],' ');}
    else if((m=s.match(/(上午|早上|下午|晚上|中午)?\s*(\d{1,2})点(半|\d{1,2}分?)?/))){
      hh=Number(m[2]);mm=m[3]==='半'?30:parseInt(m[3]||'0',10);
      if((m[1]==='下午'||m[1]==='晚上')&&hh<12)hh+=12;
      if(m[1]==='上午'&&hh===12)hh=0;
      s=s.replace(m[0],' ');
    }
    if(hh!==null){
      if(hh>23||mm>59||hh<0||mm<0)x.error='时间格式不正确，请使用 00:00–23:59。';
      else {
        if(!x.date)x.date=base;
        x.start=pad(hh)+':'+pad(mm);
        if(!x.minutes){x.minutes=30;x.warnings.push('未写时长，暂按 30 分钟安排。');}
        var end=hh*60+mm+x.minutes;
        x.endDate=plusDays(x.date,Math.floor(end/1440));end=end%1440;
        x.end=pad(Math.floor(end/60))+':'+pad(end%60);
      }
    } else if(x.minutes){x.warnings.push('只有时长、没有开始时间；时长将保留在任务详情中。');}
    x.title=s.replace(/\s+/g,' ').trim();
    if(!x.title&&!x.error)x.error='还需要写下要做的事情。';
    if(x.title.length>300&&!x.error)x.error='标题请控制在 300 字以内，长内容可写入详情。';
    return x;
  }
  // v9 planned dates were stored as wall-clock strings suffixed Z. Never shift historical times.
  function planDate(input, old, end) {
    if(!input)return null;
    if(input.length===10){
      if(!validDate(input))return null;
      return input + (old&&String(old).length>=19?String(old).slice(10):(end?'T23:59:00Z':'T00:00:00Z'));
    }
    if(String(old||'').slice(0,16)===input)return old;
    return input.slice(0,16)+':00Z';
  }
  function value(prop){if(prop===null||prop===undefined)return prop; if(typeof prop!=='object')return prop; var keys=Object.keys(prop);return keys.length?prop[keys[0]]:null;}
  function same(a,b){if((a===null||a===undefined||a==='')&&(b===null||b===undefined||b===''))return true;return JSON.stringify(a)===JSON.stringify(b);}
  function diffProps(props, base){var out={};Object.keys(props).forEach(function(k){if(!same(value(props[k]),base[k]))out[k]=props[k];});return out;}
  function intervalStats(intervals, lower, upper){
    lower=lower===undefined?0:lower;upper=upper===undefined?1440:upper;
    var a=intervals.map(function(v){return [Math.max(lower,Number(v[0])),Math.min(upper,Number(v[1]))];}).filter(function(v){return isFinite(v[0])&&isFinite(v[1])&&v[1]>v[0];}).sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
    var merged=[],total=0,i;
    for(i=0;i<a.length;i++){total+=a[i][1]-a[i][0];var last=merged[merged.length-1];if(last&&a[i][0]<=last[1])last[1]=Math.max(last[1],a[i][1]);else merged.push(a[i].slice());}
    var busy=0,gap=0,cur=lower;
    for(i=0;i<merged.length;i++){busy+=merged[i][1]-merged[i][0];gap=Math.max(gap,merged[i][0]-cur);cur=merged[i][1];}
    gap=Math.max(gap,upper-cur);
    return {busy:busy,overlap:total-busy,total:total,longestGap:gap,merged:merged};
  }
  function csv(rows,safe){return '\uFEFF'+rows.map(function(row){return row.map(function(v){v=v==null?'':String(v);if(safe&&/^[\s]*[=+@-]/.test(v))v="'"+v;return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',');}).join('\r\n');}
  function parseCSV(text){
    text=String(text||'').replace(/^\uFEFF/,'');var rows=[],row=[],s='',quoted=false,after=false,i,c;
    for(i=0;i<text.length;i++){
      c=text.charAt(i);
      if(quoted){if(c==='"'){if(text.charAt(i+1)==='"'){s+='"';i++;}else{quoted=false;after=true;}}else s+=c;}
      else if(c==='"'){if(s||after)throw new Error('CSV 引号位置不正确');quoted=true;}
      else if(c===','){row.push(s);s='';after=false;}
      else if(c==='\r'||c==='\n'){if(c==='\r'&&text.charAt(i+1)==='\n')i++;row.push(s);rows.push(row);row=[];s='';after=false;}
      else{if(after&&!/\s/.test(c))throw new Error('CSV 引号后缺少分隔符');if(!after)s+=c;}
    }
    if(quoted)throw new Error('CSV 引号未闭合');
    if(s||row.length||after){row.push(s);rows.push(row);}
    return rows;
  }
  function descendants(id,rows){var result=[],seen={};seen[id]=true;var stack=[id];while(stack.length){var cur=stack.shift();rows.forEach(function(t){var key=t._id||t.record_id||t.id;if(t['父任务ID']===cur&&key&&!seen[key]){seen[key]=true;result.push(key);stack.push(key);}});}return result;}
  function remaining(timer,now){if(!timer)return 0;return Math.max(0,Math.ceil(Number(timer.remaining||0)-(timer.running?Math.max(0,(now-timer.startedAt)/1000):0)));}
  return {safeURL:safeURL,parseCapture:parseCapture,validDate:validDate,dateString:dateString,plusDays:plusDays,planDate:planDate,diffProps:diffProps,value:value,same:same,intervalStats:intervalStats,csv:csv,parseCSV:parseCSV,descendants:descendants,remaining:remaining};
});
