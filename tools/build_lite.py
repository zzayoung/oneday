"""Build the two distinct Lite deliverables without touching the V10 full release."""
from pathlib import Path
import re,subprocess
R=Path(__file__).resolve().parents[1]
S=R/'src/lite';OUT=R/'dist/lite';OUT.mkdir(parents=True,exist_ok=True)
def script(path):
 return path.read_text().replace('</script','<\\/script')
text=(S/'shell.html').read_text()
for marker,content in {
 '/*__LITE_CSS__*/':'\n'.join((S/name).read_text() for name in ('styles.css','appearance.css','day-workspace.css','reports.css','records.css','editor-keyboard.css','calendar.css','navigation.css','fullscreen.css')),
 '/*__SHARED_CORE__*/':script(R/'src/core.js'),
 '/*__LITE_CORE__*/':script(S/'core.js'),
 '/*__LITE_STORE__*/':script(S/'store.js'),
 '/*__LITE_ATTACHMENTS__*/':script(S/'attachments.js'),
 '/*__LITE_EDITOR__*/':script(S/'editor.js'),
 '/*__LITE_THEMES__*/':script(S/'themes.js'),
 '/*__LITE_UI__*/':script(S/'ui.js')+'\n'+script(S/'appearance.js')+'\n'+script(S/'fullscreen.js'),
 '/*__LITE_VIEWS__*/':script(S/'views.js')+'\n'+script(S/'reports.js')+'\n'+script(S/'calendar.js')+'\n'+script(S/'navigation.js'),
 '/*__LITE_BOARD__*/':script(S/'board.js'),
 '/*__LITE_DIALOGS__*/':script(S/'dialogs.js')+'\n'+script(S/'panels.js'),
 '/*__LITE_TIMELINE__*/':script(S/'gestures.js')+'\n'+script(S/'timeline.js'),
 '/*__LITE_APP__*/':script(S/'app.js'),
}.items():
 assert marker in text,marker
 text=text.replace(marker,content)
for label,adapter in [('WorkBuddy正式版',''),('本机体验版','<script>'+script(S/'demo.js')+'</script>')]:
 output=text.replace('<!--__LOCAL_ADAPTER__-->',adapter)
 assert not re.search(r'/\*__[A-Z_]+__\*/|<!--__LOCAL',output)
 target=OUT/f'OneDay-Lite-{label}.html';target.write_text(output)
 for i,body in enumerate(re.findall(r'<script>(.*?)</script>',output,re.S)):
  result=subprocess.run(['node','--check'],input=body,text=True,capture_output=True)
  if result.returncode: raise RuntimeError(f'{label} script {i}: '+result.stderr)
 print(f'{target.name}: {len(output.encode()):,} bytes — JavaScript syntax OK')
