"""Local release checks. This is NOT WorkBuddy's official SDK lint."""
from pathlib import Path
from html.parser import HTMLParser
import json, re, subprocess, tempfile
R = Path(__file__).resolve().parents[1]
class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(); self.active = False; self.parts = []; self.scripts = []; self.external = []
    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            props = dict(attrs)
            if props.get('src'): self.external.append(props['src'])
            self.active = True; self.parts = []
    def handle_data(self, text):
        if self.active: self.parts.append(text)
    def handle_endtag(self, tag):
        if tag == 'script' and self.active:
            self.scripts.append(''.join(self.parts)); self.active = False
checks = []
for rel in ['todo-app/index.html', 'OneDay-v10-本机体验版.html']:
    html = (R/rel).read_text(encoding='utf-8'); parser = Scripts(); parser.feed(html)
    assert not parser.external, (rel, 'Unexpected external JavaScript dependency')
    assert parser.scripts, 'No executable scripts found'
    for i, script in enumerate(parser.scripts):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'check.js'; path.write_text(script, encoding='utf-8')
            subprocess.run(['node','--check',str(path)], check=True, capture_output=True)
    checks.append({'check': rel + ': inline JavaScript parses without external script dependencies', 'passed': True})
html = (R/'todo-app/index.html').read_text(encoding='utf-8')
ids = set(re.findall(r'databaseId\s*:\s*[\'\"]([^\'\"]+)[\'\"]', html))
expected = {'oneday-tasks','oneday-logs','oneday-tags','oneday-links','oneday-notes','oneday-sets','oneday-cal'}
assert ids == expected, (ids, expected)
assert len(re.findall(r'\bdb\.onUpdated\s*\(', html)) == 1
assert 'window.__ONEDAY_LOCAL__=true' not in html
assert 'window.__SMART_PAGE__={database:database}' not in html
assert '/*__ONEDAY_ENHANCEMENTS__*/' not in html
checks.extend([{'check':'Original seven literal table IDs, one change subscription', 'passed':True}, {'check':'Production has no injected demo adapter and no unfinished build marker','passed':True}])
(R/'docs/verification/release-checks.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding='utf-8')
for c in checks: print('PASS', c['check'])
print('Local release checks passed. Official WorkBuddy SDK lint and live acceptance are still required.')
