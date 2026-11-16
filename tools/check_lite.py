"""Offline release checks; not a replacement for the official WorkBuddy SDK validator."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,subprocess
R=Path(__file__).resolve().parents[1];checks=[]
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.in_script=False;self.parts=[];self.scripts=[];self.external=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if attrs.get('id'):self.ids.append(attrs['id'])
  if tag=='script':self.in_script=True;self.parts=[];self.external += [attrs['src']] if attrs.get('src') else []
 def handle_data(self,s):
  if self.in_script:self.parts.append(s)
 def handle_endtag(self,tag):
  if tag=='script':self.scripts.append(''.join(self.parts));self.in_script=False
def check(name,fn):fn();checks.append({'name':name,'pass':True});print('PASS',name)
def yes(value):assert value
for kind in ['本机体验版','WorkBuddy正式版']:
 h=(R/f'dist/lite/OneDay-Lite-{kind}.html').read_text();p=Parser();p.feed(h)
 check(kind+' · no external executable dependencies',lambda:yes(not p.external))
 check(kind+' · unique static IDs and resolved build markers',lambda:yes(len(p.ids)==len(set(p.ids)) and not re.search(r'/\*__[A-Z_]+__\*/',h)))
 def parse_scripts():
  for script in p.scripts:subprocess.run(['node','--check'],input=script,text=True,check=True,capture_output=True)
 check(kind+' · inline JavaScript parses',parse_scripts)
h=(R/'dist/lite/OneDay-Lite-WorkBuddy正式版.html').read_text()
expected={'oneday-tasks','oneday-logs','oneday-tags','oneday-links','oneday-notes','oneday-sets','oneday-cal'}
check('same seven literal table IDs and binding attributes',lambda:yes(set(re.findall(r"databaseId:'([^']+)'",h))==expected and set(re.findall(r'data-sp-database-id="([^"]+)"',h))==expected))
check('one update subscription, explicit SDK methods',lambda:yes(len(re.findall(r'\bdb\.onUpdated\s*\(',h))==1 and 'db[op]' not in h))
check('1.3 task capability gates and attachment target are present',lambda:yes(all(x in h for x in ['最后期限','预计时长','允许并行','TODO工作台-附件'])))
check('five named visual themes are embedded',lambda:yes(all(x in h for x in ['glass-day','paper','night','color-block','minimal']) and 'OneDayLiteThemes' in h))
check('formal release contains no sample adapter or sample records',lambda:yes('window.__SMART_PAGE__=' not in h and 'window.__ONEDAY_LOCAL__=true' not in h and 'lite-t1' not in h))
check('V10 full branch files unmodified',lambda:subprocess.run(['git','diff','--exit-code','v10.0.0','--','src/base.html','src/core.js','src/reliability.js','src/enhancements.js','src/enhancements.css','src/local-adapter.js','todo-app','tools/build.py','tools/build_preview.py','OneDay-v10-本机体验版.html'],cwd=R,check=True,capture_output=True))
(R/'docs/lite/verification/release-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print(len(checks),'checks passed. Live WorkBuddy validation remains required.')
