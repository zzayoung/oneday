"""Capture the current prototype-first Lite screens in Chromium. Uses demo data only."""
from experience import HTML,SHIM,R,V,sync_playwright
import json
shots=[]
CASES=[
 ('desktop-calendar',1440,960,'calendar'),
 ('desktop-day-sheet',1440,960,'day-sheet'),
 ('mobile-calendar',390,844,'calendar'),
 ('mobile-day-sheet',390,844,'day-sheet'),
 ('desktop-board',1440,960,'board'),
 ('desktop-notes',1440,960,'notes'),
 ('desktop-paper',1440,960,'theme:paper'),
 ('desktop-color-block',1440,960,'theme:color-block'),
 ('mobile-night',390,844,'theme:night'),
]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for name,width,height,action in CASES:
  context=b.new_context(viewport={'width':width,'height':height},timezone_id='Asia/Shanghai',device_scale_factor=1)
  p=context.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_content(HTML.replace('<head>','<head>'+SHIM,1));p.wait_for_function('window.OneDayLite?.store.state.loaded');p.wait_for_timeout(220)
  if action=='board':p.locator('#viewSwitch [data-view="board"]').click()
  elif action=='notes':p.locator('#mobileNav [data-tab="notes"]').click()
  elif action=='day-sheet':p.evaluate('OneDayLite.openDayTimeline(OneDayLite.C.localDay(),"lite-t1")')
  elif action.startswith('theme:'):p.evaluate('(id)=>OneDayLite.setTheme(id)',action.split(':',1)[1])
  p.wait_for_timeout(320);assert not errors,errors
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
  p.screenshot(path=str(V/(name+'.png')),full_page=False)
  shots.append({'file':name+'.png','width':width,'height':height,'runtimeErrors':errors,'horizontalOverflow':False});context.close()
 b.close()
(V/'screenshots.json').write_text(json.dumps(shots,ensure_ascii=False,indent=2));print('Captured',len(shots),'screens, no horizontal overflow or runtime errors.')
