"""Build OneDay's Sites edition from the retained Lite modules; never include demo.js."""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src/lite'

def script(path):
    return path.read_text().replace('</script', '<\\/script')

def build():
    text = (SRC / 'shell.html').read_text()
    chunks = {
        '/*__LITE_CSS__*/': '\n'.join((SRC / name).read_text() for name in ('styles.css','appearance.css','day-workspace.css','reports.css','records.css','editor-keyboard.css','calendar.css','navigation.css','fullscreen.css')),
        '/*__SHARED_CORE__*/': script(ROOT / 'src/core.js'),
        '/*__LITE_CORE__*/': script(SRC / 'core.js'),
        '/*__LITE_STORE__*/': script(SRC / 'store.js'),
        '/*__LITE_ATTACHMENTS__*/': script(SRC / 'attachments.js'),
        '/*__LITE_EDITOR__*/': script(SRC / 'editor.js'),
        '/*__LITE_THEMES__*/': script(SRC / 'themes.js'),
        '/*__LITE_UI__*/': script(SRC / 'ui.js')+'\n'+script(SRC / 'appearance.js')+'\n'+script(SRC / 'fullscreen.js'),
        '/*__LITE_VIEWS__*/': script(SRC / 'views.js')+'\n'+script(SRC / 'reports.js')+'\n'+script(SRC / 'calendar.js')+'\n'+script(SRC / 'navigation.js'),
        '/*__LITE_BOARD__*/': script(SRC / 'board.js'),
        '/*__LITE_DIALOGS__*/': script(SRC / 'dialogs.js')+'\n'+script(SRC / 'panels.js')+'\n'+script(SRC / 'cloud-ui.js'),
        '/*__LITE_TIMELINE__*/': script(SRC / 'gestures.js')+'\n'+script(SRC / 'timeline.js'),
        '/*__LITE_APP__*/': script(SRC / 'app.js'),
    }
    for marker, content in chunks.items():
        assert marker in text, marker
        text = text.replace(marker, content)
    text = text.replace('<!--__LOCAL_ADAPTER__-->', '<!--__SITES_IDENTITY__--><script>'+script(SRC / 'cloud.js')+'</script>')
    text = text.replace('<title>OneDay Lite · 少一点，从容一点</title>', '<title>OneDay · 任务与记录</title><meta name="description" content="私人的任务与记录空间。安排每一天，留下每一个想法。"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="icon" href="/favicon.svg">')
    assert 'oneday.lite.v1.local-data' not in text
    assert not re.search(r'/\*__[A-Z_]+__\*/|<!--__LOCAL', text)
    for index, body in enumerate(re.findall(r'<script>(.*?)</script>', text, re.S)):
        result = subprocess.run(['node', '--check'], input=body, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(f'Sites script {index}: {result.stderr}')
    output = ROOT / 'app/oneday.html'
    output.write_text(text)
    print(f'OneDay Sites: {len(text.encode()):,} bytes, JavaScript syntax OK, no demo database')

if __name__ == '__main__':
    build()
