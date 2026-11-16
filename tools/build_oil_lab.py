"""Build the isolated Oil UI comparison without a production data adapter."""
from pathlib import Path
import re
import runpy
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
OIL = ROOT / 'src/oil'

runpy.run_path(str(ROOT / 'tools/build_lite.py'))
base = (OUT / 'lite/OneDay-Lite-本机体验版.html').read_text()
base = base.replace('oneday.lite.v1.local-data', 'oneday.oil-lab.v1.local-data')
base = base.replace('<head>', '<head><script>window.__ONEDAY_SCOPE__="oil-lab";</script>', 1)
base = base.replace('<small>LITE</small>', '<small>UI LAB</small>')
base = base.replace('</head>', '<style>' + (OIL / 'lab.css').read_text() + '</style></head>')

def write_page(name, oil):
    page = base.replace('<title>OneDay | 个人待办、日历与笔记</title>',
                        '<title>OneDay · ' + ('Oil UI 时间索引' if oil else '1.9 原版对照') + '</title>')
    bar = '<div class="oil-lab-switch" aria-label="界面对照"><span>界面对照</span>'
    bar += '<a href="/baseline.html"' + (' aria-current="page"' if not oil else '') + '>1.9 原版</a>'
    bar += '<a href="/"' + (' aria-current="page"' if oil else '') + '>Oil UI</a></div>'
    page = page.replace('<div class="top-actions">', bar + '<div class="top-actions">', 1)
    if oil:
        page = page.replace('<html ', '<html data-oil="true" ', 1)
        page = page.replace('</head>', '<style>' + (OIL / 'oil.css').read_text() + '</style></head>')
        theme = 'window.OneDayLiteThemes.themes["oil-index"]={name:"时间索引 · Oil UI",color:"#f4f4ef",reflection:false,description:"纸白与松绿 · 清晰的一天",palette:["#f4f4ef","#ffffff","#28584b"]};window.OneDayLiteThemes.ids.push("oil-index");\n'
        page = page.replace('/* Small shared UI foundation.', theme + '/* Small shared UI foundation.', 1)
        page = page.replace("read('theme','mist-blue')", "read('theme','oil-index')", 1)
        page = page.replace('OneDay 1.8 · 任务与记录', 'OneDay 1.9 · Oil UI 试验版')
        page = page.replace('四套新配色，点击即可切换。', '选择适合当前阅读环境的配色。')
        # Run the UI layer before the app creates its store and first renders.
        ui = '\n'.join((OIL / p).read_text() for p in ('calendar.js', 'oil.js'))
        page = page.replace('/* Composition root: input, action routing, keyboard, drag/drop, and host lifecycle. */',
                            ui.replace('</script', '<\\/script') + '\n/* Composition root: input, action routing, keyboard, drag/drop, and host lifecycle. */', 1)
    else:
        page = page.replace('window.__ONEDAY_SCOPE__="oil-lab"', 'window.__ONEDAY_SCOPE__="oil-lab-base"', 1)
    for index, script in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', page, re.S)):
        result = subprocess.run(['node', '--check'], input=script, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(f'{name}, script {index}: {result.stderr}')
    assert 'window.__ONEDAY_SITES__=true' not in page
    assert 'oneday.lite.v1.local-data' not in page
    (OUT / name).write_text(page)
    print(f'{name}: {len(page.encode()):,} bytes — isolated local data, JavaScript syntax OK')

write_page('baseline.html', False)
write_page('index.html', True)
(OUT / 'compare.html').write_text((OIL / 'compare.html').read_text())
for generated in (OUT / 'lite').iterdir():
    generated.unlink()
(OUT / 'lite').rmdir()
