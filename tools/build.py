from pathlib import Path
import subprocess,json
R=Path(__file__).resolve().parents[1]
h=(R/'src/base.html').read_text()
for name in ['reliability.js','enhancements.js']:
 if not (R/'src'/name).exists(): continue
h=h.replace('  /*__ONEDAY_ENHANCEMENTS__*/','\n'+ '\n'.join((R/'src'/f).read_text() for f in ['reliability.js','enhancements.js'] if (R/'src'/f).exists()))
css=(R/'src/enhancements.css').read_text() if (R/'src/enhancements.css').exists()else''
h=h.replace('</style>','\n'+css+'\n</style>',1)
core=(R/'src/core.js').read_text()
h=h.replace('<script>\n(function () {', '<script>\n'+core+'\n</script>\n<script>\n(function () {',1)
(R/'todo-app/index.html').write_text(h)
subprocess.run(['python',str(R/'todo-app/dev/_build_mock.py')],check=True)
print('Built production single HTML:',len(h.encode()),'bytes')
if (R/'src/local-adapter.js').exists():
 subprocess.run(['python',str(R/'tools/build_preview.py')],check=True)
