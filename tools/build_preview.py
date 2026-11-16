"""Generate a explicitly local-only demo. No network / cloud credentials."""
from pathlib import Path
from datetime import datetime,timedelta
import json
R=Path(__file__).resolve().parents[1]
keys={'tasks':'oneday-tasks','logs':'oneday-logs','tags':'oneday-tags','links':'oneday-links','notes':'oneday-notes','sets':'oneday-sets','cal':'oneday-cal'}
now=datetime.now();today=now.strftime('%Y-%m-%d');yesterday=(now-timedelta(days=1)).strftime('%Y-%m-%d');tomorrow=(now+timedelta(days=1)).strftime('%Y-%m-%d');stamp=now.strftime('%Y-%m-%dT%H:%M:%SZ')
D={k:[]for k in keys.values()}
def task(i,title,status='收集（未开始）',priority='中',date=None,start='00:00',end='23:59',detail='这是一条可自由修改的示例任务，不是真实云端数据。',parent=''):
 r={'_id':'demo-'+str(i),'任务标题':title,'任务类型':'子任务'if parent else'主任务','父任务ID':parent,'任务状态':status,'优先级':priority,'任务详情':detail,'任务描述':'示例数据','创建时间':yesterday+'T09:00:00Z','状态开始时间':stamp if status=='完成'else yesterday+'T09:00:00Z','回收站':False}
 if date:r.update({'计划开始时间':date+'T'+start+':00Z','计划截止时间':date+'T'+end+':00Z'})
 D[keys['tasks']].append(r);return r
r=task(1,'把产品方案再打磨一遍','进行中','高',today,'09:30','10:30', '# 不求一次做到完美\n\n先把最重要的三件事说清楚：\n\n- [ ] 面向谁，解决什么问题\n- [ ] 和现有方案有什么差异\n- [ ] 下一步如何验证\n\n> 完成一个能讨论的版本，比一直等灵感更有用。')
task(2,'留 30 分钟，读完那篇长文',priority='中',date=today,start='14:00',end='14:30')
task(3,'约伙伴聊聊下一步合作',priority='高',date=today,start='15:00',end='15:45')
task(4,'整理上周的零散记录',status='完成',priority='低',date=today,start='08:30',end='09:00')
task(5,'晚饭后，去散一会儿步',priority='低',date=today,start='19:00',end='19:30')
task(6,'把待确认的问题发给对方',priority='中',date=yesterday,start='16:00',end='16:30')
task(7,'研究一个让记录更轻松的小点子',priority='低')
task(8,'整理想看的书单',priority='低')
task(9,'给项目留一份完整备份',priority='中')
task(10,'先补齐用户使用场景',status='进行中',priority='高',date=tomorrow,start='10:00',end='10:30',parent='demo-1')
for i,name,color in [(1,'工作','青'),(2,'学习','蓝'),(3,'生活','绿')]:D[keys['tags']].append({'_id':'tag-'+str(i),'标签名称':name,'标签分类':name,'标签颜色':color,'创建时间':stamp})
for i,name in [(1,'工作'),(2,'学习'),(3,'工作'),(5,'生活'),(6,'工作')]:D[keys['links']].append({'_id':'link-'+str(i),'关联标题':'示例标签','任务ID':'demo-'+str(i),'标签名称':name,'创建时间':stamp})
for i,content,cat in [(1,'今天的一个提醒：与其把列表写得很满，不如认真完成一件重要的事。','灵感'),(2,'做产品时，先问用户下一步要做什么，再决定页面上要放什么。','记录'),(3,'周末想去找一个有树荫的地方走走，带上相机。','灵感')]:D[keys['notes']].append({'_id':'note-'+str(i),'便签内容':content,'便签分类':cat,'便签状态':'未处理','来源':'OneDay 示例','创建时间':stamp,'更新时间':stamp,'置顶':i==1})
D[keys['sets']]=[{'_id':'set-bg','设置项':'workbench.bg','设置值':json.dumps({'type':'solid','value':'#f5f4f0','name':'纸间留白','panel':.96},ensure_ascii=False),'更新时间':stamp},{'_id':'set-day','设置项':'oneday.plan.'+today,'设置值':'["demo-1","demo-2"]','更新时间':stamp}]
D[keys['logs']]=[{'_id':'log-1','日志标题':'示例：收集阶段','任务ID':'demo-1','任务标题':r['任务标题'],'任务类型':'主任务','状态':'收集（未开始）','开始时间':yesterday+'T08:00:00Z','结束时间':yesterday+'T09:00:00Z','持续时长':1}]
(R/'todo-app/dev/demo-data-v10.json').write_text(json.dumps(D,ensure_ascii=False,indent=2))
script=(R/'src/local-adapter.js').read_text().replace('/*__DEMO_DATA__*/',json.dumps(D,ensure_ascii=False).replace('</','<\\/')).replace('/*__TABLE_IDS__*/',json.dumps(keys))
h=(R/'todo-app/index.html').read_text().replace('<title>OneDay · 从容地过好每一天</title>','<title>OneDay V10 · 本机体验版（非云同步）</title>')
marker="<script>\n(function () {\n  'use strict';"
assert marker in h
h=h.replace(marker,'<script>\n'+script+'\n</script>\n'+marker,1)
(R/'OneDay-v10-本机体验版.html').write_text(h)
print('Built isolated local demo',len(h.encode()),'bytes')
