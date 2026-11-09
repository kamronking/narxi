# Probe category structure of the stores we already use (robots-respecting, honest UA)
import json, re, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from scrape import get, allowed
OUT = 'docs/data/probe3'; os.makedirs(OUT, exist_ok=True)
res = {}
def save(name, txt): open(f'{OUT}/{name}', 'w').write(txt[:400000])
def tryget(key, url):
    try:
        ok = allowed(url); r = get(url) if ok else None
        res[key] = {'url': url, 'allowed': ok, 'status': r.status_code if r else None, 'len': len(r.text) if r else 0}
        return r.text if r is not None and r.status_code == 200 else ''
    except Exception as e:
        res[key] = {'url': url, 'err': repr(e)}; return ''
# texnomart
h = tryget('tm_home', 'https://texnomart.uz/ru/')
res['tm_home_cats'] = sorted(set(re.findall(r'/ru/katalog/([a-z0-9\-]+)/', h)))
for sm in ['https://texnomart.uz/sitemap.xml', 'https://texnomart.uz/robots.txt']:
    t = tryget('tm_' + sm.rsplit('/', 1)[1], sm); save('tm_' + sm.rsplit('/', 1)[1], t)
    res['tm_' + sm.rsplit('/', 1)[1] + '_cats'] = sorted(set(re.findall(r'/katalog/([a-z0-9\-]+)/', t)))[:400]
    res['tm_' + sm.rsplit('/', 1)[1] + '_locs'] = re.findall(r'<loc>([^<]+)</loc>', t)[:60]
# olcha
for k, u in [('ol_cats', 'https://mobile.olcha.uz/api/v2/categories'), ('ol_cats2', 'https://mobile.olcha.uz/api/v1/categories'),
             ('ol_menu', 'https://mobile.olcha.uz/api/v2/categories/tree'), ('ol_robots', 'https://mobile.olcha.uz/robots.txt'),
             ('ol_prod_tv', 'https://mobile.olcha.uz/api/v2/products?q=televizor&page=1&per_page=5'),
             ('ol_prod_lap', 'https://mobile.olcha.uz/api/v2/products?q=noutbuk&page=1&per_page=5')]:
    t = tryget(k, u); save(k + '.json', t)
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False)[:3000])
