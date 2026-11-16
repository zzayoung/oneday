const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {module:{exports:{}}, Intl, Date};
vm.runInNewContext(fs.readFileSync('src/lite/calendar.js','utf8'),context);
const cal = context.module.exports;
test('2026 Spring Festival and national day arrangements',()=>{
 assert.equal(cal.holiday('2026-02-17').text,'春节');
 for(let d=1;d<=7;d++) assert.equal(cal.holiday(`2026-10-0${d}`).kind,'holiday');
 assert.equal(cal.holiday('2026-10-10').kind,'workday');
 assert.equal(cal.holiday('2027-10-01'),null);
});
test('2025 holiday, Qingming and HKO solar term dates',()=>{
 assert.equal(cal.holiday('2025-01-26').kind,'workday');
 assert.equal(cal.holiday('2025-04-04').text,'清明节');
 assert.equal(cal.solarTerm('2025-04-04'),'清明');
 assert.equal(cal.solarTerm('2026-04-05'),'清明');
 assert.equal(cal.solarTerm('2027-03-06'),'惊蛰');
 assert.equal(cal.solarTerm('2028-04-04'),'');
});
test('lunar conversion uses Chinese calendar and omits unavailable formatter',()=>{
 assert.equal(cal.lunar('2026-02-17'),'正月');
 assert.equal(cal.lunar('2026-02-18'),'初二');
 assert.equal(cal.lunar('2026-02-17',null),'');
 assert.equal(cal.lunar('2026-02-17',{resolvedOptions:()=>({calendar:'gregory'}),formatToParts:()=>[{type:'month',value:'2'},{type:'day',value:'17'}]}),'');
});
test('current week is the only enlarged row and absent outside displayed grid',()=>{
 const days=Array.from({length:35},(_,i)=>new Date(Date.UTC(2026,9,26+i)).toISOString().slice(0,10));
 assert.equal(cal.weekWeights(days,'2026-11-05'),'1fr 3.2fr 1fr 1fr 1fr');
 assert.equal(cal.weekWeights(days,'2026-11-05',true),'1fr 5fr 1fr 1fr 1fr');
 assert.equal(cal.weekWeights(days,'2027-01-01'),'1fr 1fr 1fr 1fr 1fr');
});
test('calendar renders actual execution water and current week task actions',()=>{
 const C=require('../../src/lite/core.js');
 const task={_id:'t','任务标题':'真实安排','任务状态':'完成','计划开始时间':'2025-10-28T09:00:00','计划截止时间':'2025-10-28T10:00:00'};
 const log={_id:'l','任务ID':'t','状态':'进行中','开始时间':'2025-10-28T09:00:00','结束时间':'2025-10-28T09:30:00'};
 const core={...C,localDay:()=> '2025-10-28'};
 const L={C:core,UI:{date:'2025-10-28'},store:{data:{logs:[log],cal:[]}},tasks:()=>[task],statusClass:()=> 'done',icon:()=>'<svg></svg>'};
 cal.install(L,{innerWidth:390});const html=L.renderCalendar([task]);
 const day=html.match(/<div class="day[^\"]*current-week[^\"]*"[^>]*data-date="2025-10-28"[\s\S]*?(?=<div class="day marker-|<\/div><\/section>)/)[0];
 assert.match(day,/data-exec-ms="1800000"/);
 assert.match(day,/data-act="day-timeline"/);
 assert.match(day,/真实安排/);
 assert.match(day,/calendar-today-icon/);
});
test('compact official badges preserve readable holiday and makeup-workday meaning and full accessible names',()=>{
 const C=require('../../src/lite/core.js');
 const L={C:{...C,localDay:()=> '2026-10-10'},UI:{date:'2026-10-10'},store:{data:{logs:[],cal:[]}},tasks:()=>[],statusClass:()=>'',icon:()=>'<svg></svg>'};
 cal.install(L,{innerWidth:390});const html=L.renderCalendar([]);
 const day=date=>html.match(new RegExp('<div class="day[^\\"]*"[^>]*data-date="'+date+'"[\\s\\S]*?(?=<div class="day marker-|</div></section>)'))[0];
 assert.match(day('2026-10-01'),/aria-label="2026-10-01，国庆节/);
 assert.match(day('2026-10-01'),/class="calendar-marker-compact">休<\/span>/);
 assert.match(day('2026-10-10'),/aria-label="2026-10-10，调休上班/);
 assert.match(day('2026-10-10'),/class="calendar-marker-compact">班<\/span>/);
 assert.match(day('2026-10-10'),/calendar-today-icon/);
});

test('phone current week renders three task titles within weighted row',()=>{
 const C=require('../../src/lite/core.js');
 const tasks=['完成项目规划','整理客户反馈','准备团队会议','第四个任务'].map((title,i)=>({_id:String(i),'任务标题':title,'任务状态':'完成','计划开始时间':'2025-10-28T09:00:00','计划截止时间':'2025-10-28T10:00:00'}));
 const L={C:{...C,localDay:()=> '2025-10-28'},UI:{date:'2025-10-28'},store:{data:{logs:[],cal:[]}},tasks:()=>tasks,statusClass:()=> 'done',icon:()=>'<svg></svg>'};
 cal.install(L,{innerWidth:390});const html=L.renderCalendar(tasks);
 const day=html.match(/<div class="day[^\"]*current-week[^\"]*"[^>]*data-date="2025-10-28"[\s\S]*?(?=<div class="day marker-|<\/div><\/section>)/)[0];
 for(const title of ['完成项目规划','整理客户反馈','准备团队会议'])assert.match(day,new RegExp(title));
 assert.doesNotMatch(day,/第四个任务/);assert.match(day,/>\+1<\/button>/);
 assert.match(html,/--calendar-rows:[^\"]*5fr/);
});
