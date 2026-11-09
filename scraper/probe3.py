import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scrape import get, allowed
OUT = 'docs/data/probe3'; os.makedirs(OUT, exist_ok=True)
res = {}
def g(url):
    try:
        if not allowed(url): return None, 'robots'
        r = get(url); return r, r.status_code
    except Exception as e: return None, repr(e)
# texnomart categories sitemap
r, st = g('https://texnomart.uz/sitemap-ru-categories.xml'); t = r.text if r is not None else ''
open(f'{OUT}/tm_cats.xml', 'w').write(t); res['tm_cats_status'] = st; res['tm_cats_n'] = len(re.findall('<loc>', t))
# one category page size + pagination
for cat in ['televizory', 'noutbuki', 'holodilniki']:
    r, st = g(f'https://texnomart.uz/ru/katalog/{cat}/')
    n = len(re.findall(r'"@type"\s*:\s*"ListItem"', r.text)) if r is not None else 0
    pages = sorted(set(int(x) for x in re.findall(r'[?&]page=(\d+)', r.text))) if r is not None else []
    res['tm_' + cat] = {'st': st, 'items': n, 'pages': pages[-3:]}
# olcha category filter param
for k, u in [('cat_id', 'https://mobile.olcha.uz/api/v2/products?category_id=2&page=1&per_page=3'),
             ('cat', 'https://mobile.olcha.uz/api/v2/products?category=2&page=1&per_page=3'),
             ('cat_alias', 'https://mobile.olcha.uz/api/v2/products?category=televizory&page=1&per_page=3'),
             ('cats_arr', 'https://mobile.olcha.uz/api/v2/products?categories=2&page=1&per_page=3'),
             ('cat_path', 'https://mobile.olcha.uz/api/v2/categories/televizory/products?page=1&per_page=3'),
             ('all', 'https://mobile.olcha.uz/api/v2/products?page=1&per_page=3')]:
    r, st = g(u)
    try:
        d = r.json()['data']; res['ol_' + k] = {'st': st, 'total': d['paginator']['total'], 'cats': [p['category']['name_ru'] for p in d['products']]}
    except Exception as e: res['ol_' + k] = {'st': st, 'err': repr(e)[:120], 'body': (r.text[:200] if r is not None else '')}
json.dump(res, open(f'{OUT}/summary2.json', 'w'), ensure_ascii=False, indent=1)
