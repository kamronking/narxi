"""Ishonch.uz structure: sitemap(s), a category page, a product page."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe21'; os.makedirs(OUT, exist_ok=True); res = {}
def get(name, u):
    try:
        r = requests.get(u, headers=H, timeout=30); t = r.text
        open(f'{OUT}/{name}.txt', 'w').write(t[:1500000])
        res[name] = {'u': u, 'st': r.status_code, 'len': len(t)}
        return t
    except Exception as e:
        res[name] = {'u': u, 'err': repr(e)[:150]}; return ''
get('robots', 'https://ishonch.uz/robots.txt')
sm = get('sitemap', 'https://ishonch.uz/sitemap.xml')
locs = re.findall(r'<loc>(.*?)</loc>', sm)
res['locs_sample'] = locs[:40]; res['locs_n'] = len(locs)
pats = {}
for l in locs:
    k = re.sub(r'https://[^/]+', '', l).split('/')[1:3]; k = '/'.join(k[:1]); pats[k] = pats.get(k, 0) + 1
res['loc_patterns'] = pats
subs = [l for l in locs if l.endswith('.xml')]
for i, l in enumerate(subs[:4]):
    t = get(f'sub{i}', l); res[f'sub{i}_sample'] = re.findall(r'<loc>(.*?)</loc>', t)[:15]; res[f'sub{i}_n'] = len(re.findall(r'<loc>', t))
get('home', 'https://ishonch.uz/')
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print('JSONSTART'); print(json.dumps(res, ensure_ascii=False)); print('JSONEND')
