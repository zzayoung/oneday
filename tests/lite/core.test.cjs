const {test}=require('node:test');const A=require('node:assert/strict'),fs=require('node:fs');
const p='../../src/lite/core.js';const C=fs.existsSync(require('node:path').join(__dirname,p))?require(p):{};
const t=(status='进行中',start='2026-09-21T09:00:00Z')=>({_id:'t','任务标题':'测试','任务状态':status,'状态开始时间':start,'创建时间':'2026-09-20T08:00:00Z'});
const log=(s,a,b,id='l')=>({_id:id,'任务ID':'t','状态':s,'开始时间':a,'结束时间':b});
const now=Date.parse('2026-09-21T10:00:00Z');
test('Lite core has executable time model',()=>A.equal(typeof C.taskTime,'function'));
test('running current state uses real elapsed time',()=>A.equal(C.taskTime(t(),[],now).doing,3600000));
test('pause is excluded from execution',()=>{const x=C.taskTime(t('暂停'),[log('进行中','2026-09-21T08:00:00Z','2026-09-21T09:00:00Z')],now);A.equal(x.doing,3600000);A.equal(x.paused,3600000)});
test('overlapping historical segments union not sum',()=>{const x=C.taskTime(t('完成'),[log('进行中','2026-09-21T07:00:00Z','2026-09-21T08:00:00Z'),log('进行中','2026-09-21T07:30:00Z','2026-09-21T08:30:00Z','l2')],now);A.equal(x.doing,5400000);A.equal(x.overlap,1800000)});
test('matching legacy open log and implicit running not double counted',()=>A.equal(C.taskTime(t(),[log('进行中','2026-09-21T09:00:00Z',null)],now).doing,3600000));
test('stale open logs do not run forever',()=>{const x=C.taskTime(t('完成'),[log('进行中','2026-09-19T09:00:00Z',null)],now);A.equal(x.doing,0);A.ok(x.issues.length)});
test('missing state start never guesses from creation',()=>A.equal(C.taskTime(t('进行中',''),[],now).doing,0));
test('future start and invalid intervals do not count negative time',()=>{const x=C.taskTime(t('进行中','2030-01-01T09:00:00Z'),[log('进行中','bad','bad')],now);A.equal(x.doing,0);A.ok(x.issues.length>=1)});
test('range clips cross midnight execution',()=>A.equal(C.taskTime(t('完成'),[log('进行中','2026-09-20T23:30:00Z','2026-09-21T00:30:00Z')],now,[Date.parse('2026-09-21T00:00:00Z'),now]).doing,1800000));
test('terminal elapsed stops at terminal status start',()=>A.equal(C.taskTime(t('完成'),[],now).elapsed,25*3600000));
test('workspace union avoids parallel task double count',()=>{const a=t(),b={...t(),_id:'b'};const x=C.summary([a,b],[],now);A.equal(x.total,7200000);A.equal(x.unique,3600000);A.equal(x.overlap,3600000)});
test('trash tasks excluded from aggregate',()=>A.equal(C.summary([{...t(),'回收站':true}],[],now).total,0));
test('month grid aligned to Monday and includes target',()=>{let x=C.monthDays('2026-09-21');A.equal(x[0],'2026-08-31');A.equal(x.length%7,0);A.ok(x.includes('2026-09-30'))});
test('week range Monday through Sunday',()=>A.deepEqual(C.weekDays('2026-09-23'),['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27']));
test('unscheduled does not appear scheduled',()=>A.equal(C.onDay(t(),'2026-09-21'),false));
test('multi-day task included in intervening dates',()=>A.ok(C.onDay({...t(),'计划开始时间':'2026-09-20T14:00:00Z','计划截止时间':'2026-09-22T16:00:00Z'},'2026-09-21')));
test('calendar movement keeps wall clock and duration',()=>A.deepEqual(C.movePlan({'计划开始时间':'2026-09-20T23:00:00Z','计划截止时间':'2026-09-21T01:00:00Z'},'2026-09-23'),{'计划开始时间':{date:'2026-09-23T23:00:00Z'},'计划截止时间':{date:'2026-09-24T01:00:00Z'}}));
test('unscheduled calendar drop creates all-day slot',()=>A.equal(C.movePlan({},'2026-09-21')['计划截止时间'].date,'2026-09-21T23:59:00Z'));
test('format clock does not wrap after 24 hours',()=>A.equal(C.clock(26*3600000+61000),'26:01:01'));
test('human time includes seconds below one minute',()=>A.equal(C.duration(45000),'45秒'));
test('markdown escapes raw script',()=>{let h=C.markdown('<script>alert(1)</script>');A.ok(!h.includes('<script>'));A.ok(h.includes('&lt;script&gt;'))});
test('markdown rejects unsafe protocols',()=>{let h=C.markdown('[click](javascript:alert) ![x](data:text/html,x)');A.ok(!h.includes('href="javascript:'));A.ok(!h.includes('src="data:text'))});
test('markdown supports lists and checklist source line markers',()=>{let h=C.markdown('# 计划\n\n- [ ] 第一步\n- [x] 第二步\n\n**重点**');A.ok(h.includes('<h1>'));A.ok(h.includes('data-line="2"'));A.ok(h.includes('<strong>重点</strong>'))});
test('markdown fenced code stays literal',()=>{let h=C.markdown('```js\n<b>hi</b>\n```');A.ok(h.includes('<pre>'));A.ok(h.includes('&lt;b&gt;'))});
test('toggle checklist changes only requested source line',()=>A.equal(C.toggleCheck('- [ ] a\n- [x] b',0),'- [x] a\n- [x] b'));
test('record time input uses actual UTC instant round trip',()=>{const x='2026-09-21T03:20:00Z';A.equal(Date.parse(C.fromLocal(C.toLocal(x))),Date.parse(x))});
test('validate manual closed log rejects inverted range',()=>A.throws(()=>C.validateInterval('2026-09-21T10:00:00Z','2026-09-21T09:00:00Z',now),/晚于/));
test('validate manual log rejects future end',()=>A.throws(()=>C.validateInterval('2026-09-21T09:00:00Z','2026-09-22T09:00:00Z',now),/未来/));
test('descendants cycle safe inherited helper',()=>A.deepEqual(C.descendants('a',[{_id:'b','父任务ID':'a'},{_id:'c','父任务ID':'b'},{_id:'a','父任务ID':'c'}]),['b','c']));

test('timeline range keeps timed task inside selected day',()=>{
 const x=C.timelineRange({'计划开始时间':'2026-09-24T10:15:00Z','计划截止时间':'2026-09-24T11:45:00Z'},'2026-09-24');
 A.deepEqual(x,{kind:'timed',start:615,end:705,spans:false});
});
test('timeline parks all-day and cross-day tasks instead of stretching them',()=>{
 A.equal(C.timelineRange({'计划开始时间':'2026-09-24T00:00:00Z','计划截止时间':'2026-09-24T23:59:00Z'},'2026-09-24').kind,'all-day');
 A.equal(C.timelineRange({'计划开始时间':'2026-09-23T22:00:00Z','计划截止时间':'2026-09-24T09:00:00Z'},'2026-09-24').kind,'span');
});
test('timeline defaults single-ended plan to one hour',()=>{
 A.deepEqual(C.timelineRange({'计划开始时间':'2026-09-24T21:30:00Z'},'2026-09-24'),{kind:'timed',start:1290,end:1350,spans:false});
});
test('timeline layout keeps ordinary overlaps on main track and explicit parallel on secondary track',()=>{
 const rows=[
  {_id:'a','计划开始时间':'2026-09-24T09:00:00Z','计划截止时间':'2026-09-24T10:00:00Z'},
  {_id:'b','计划开始时间':'2026-09-24T09:30:00Z','计划截止时间':'2026-09-24T10:30:00Z'},
  {_id:'c','计划开始时间':'2026-09-24T09:45:00Z','计划截止时间':'2026-09-24T10:15:00Z','允许并行':true},
  {_id:'d','计划开始时间':'2026-09-24T14:00:00Z','计划截止时间':'2026-09-24T15:00:00Z','允许并行':true}
 ];
 const bars=C.timelineLayout(rows,'2026-09-24');
 A.equal(bars.find(x=>x.id==='a').track,'main');
 A.equal(bars.find(x=>x.id==='b').track,'main');
 A.equal(bars.find(x=>x.id==='a').laneCount,1);
 A.equal(bars.find(x=>x.id==='b').laneCount,1);
 A.equal(bars.find(x=>x.id==='c').track,'parallel');
 A.equal(bars.find(x=>x.id==='d').track,'main');
});
test('timeline layout separates main and child roles',()=>{
 const rows=[
  {_id:'p','任务类型':'主任务','计划开始时间':'2026-09-24T09:00:00Z','计划截止时间':'2026-09-24T10:00:00Z'},
  {_id:'s','任务类型':'子任务','父任务ID':'p','计划开始时间':'2026-09-24T09:15:00Z','计划截止时间':'2026-09-24T09:45:00Z'}
 ];
 A.deepEqual(C.timelineLayout(rows,'2026-09-24',{role:'main'}).map(x=>x.id),['p']);
 A.deepEqual(C.timelineLayout(rows,'2026-09-24',{role:'sub',parentId:'p'}).map(x=>x.id),['s']);
 A.deepEqual(C.timelineLayout(rows,'2026-09-24',{role:'combined'}).map(x=>x.id).sort(),['p','s']);
});
test('timeline move snaps to ten minutes and clamps to the day',()=>{
 A.deepEqual(C.timelineMove(600,690,17),{start:620,end:710});
 A.deepEqual(C.timelineMove(30,120,-100),{start:0,end:90});
 A.deepEqual(C.timelineMove(1380,1440,100),{start:1380,end:1440});
});
test('timeline resize keeps at least ten minutes',()=>{
 A.deepEqual(C.timelineResize(600,660,'start',654),{start:650,end:660});
 A.deepEqual(C.timelineResize(600,660,'end',602),{start:600,end:610});
});
test('timeline patch writes same-day wall clock without timezone drift',()=>{
 A.deepEqual(C.timelinePatch('2026-09-24',615,705),{'计划开始时间':{date:'2026-09-24T10:15:00Z'},'计划截止时间':{date:'2026-09-24T11:45:00Z'}});
});


test('estimate defaults to 60 and accepts positive snapped minutes',()=>{
 A.equal(C.taskEstimateMinutes({}),60);
 A.equal(C.taskEstimateMinutes({'预计时长':45}),50);
 A.equal(C.taskEstimateMinutes({'预计时长':52}),50);
 A.equal(C.taskEstimateMinutes({'预计时长':0}),60);
});

test('single-track conflict excludes explicit parallel tasks',()=>{
 const day='2026-09-24';
 const rows=[
  {_id:'a','任务类型':'主任务','计划开始时间':day+'T09:00:00Z','计划截止时间':day+'T10:00:00Z'},
  {_id:'b','任务类型':'主任务','计划开始时间':day+'T09:30:00Z','计划截止时间':day+'T10:30:00Z','允许并行':true}
 ];
 A.deepEqual(C.timelineConflicts(rows,day,'x',570,615).map(x=>x.id),['a']);
});

test('timeline plan finds next free snapped slot without moving other tasks',()=>{
 const day='2026-09-24';
 const rows=[
  {_id:'a','计划开始时间':day+'T09:00:00Z','计划截止时间':day+'T10:00:00Z'},
  {_id:'b','计划开始时间':day+'T10:00:00Z','计划截止时间':day+'T10:30:00Z'}
 ];
 const x=C.timelinePlan(rows,day,'x',570,600);
 A.equal(x.conflicts.length,1);
 A.deepEqual(x.next,{start:630,end:660});
});

test('calendar labels prefer personal leave over holiday and workday override over weekend',()=>{
 const ds='2026-09-26';
 A.deepEqual(C.calendarLabel(ds,[{'标记日期':ds,'标记类型':'请假','标记标题':'年假'}]),{kind:'leave',text:'年假'});
 A.equal(C.calendarLabel(ds,[{'标记日期':ds,'标记类型':'法定节假日','标记标题':'中秋节'}]).kind,'holiday');
 A.equal(C.calendarLabel(ds,[{'标记日期':ds,'标记类型':'调休上班','标记标题':'调休'}]).kind,'workday');
 A.equal(C.calendarLabel(ds,[]).kind,'weekend');
});
test('markdown keeps safe document links while stripping dangerous URLs',()=>{
 const h=C.markdown('[📎 方案.pdf](https://files.example.com/plan.pdf) [坏链接](javascript:alert(1))');
 A.ok(h.includes('href="https://files.example.com/plan.pdf"'));
 A.ok(!h.includes('href="javascript:'));
});


test('reorder indices are dense after cross-column move',()=>{
 A.deepEqual(C.reorder(['a','b','c'],'b',['x','y'],1),{source:['a','c'],target:['x','b','y']});
});
