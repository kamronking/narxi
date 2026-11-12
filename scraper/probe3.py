"""openshop: pagination of category JSON-LD ItemList."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe15'; os.makedirs(OUT, exist_ok=True); res = {}
def items(u):
    t = requests.get(u, headers=H, timeout=30).text
    for blk in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', t, re.S):
        try: j = json.loads(blk)
        except Exception: continue
        me = j.get('mainEntity') if isinstance(j, dict) else None
        if me and me.get('@type') == 'ItemList':
            el = me.get('itemListElement', [])
            return {'n_total': me.get('numberOfItems'), 'n': len(el), 'first': el[0]['position'] if el else None,
                    'ex': [(e['item'].get('name'), e['item'].get('offers', {}).get('price'), e['item'].get('offers', {}).get('availability', '').split('/')[-1], e.get('url', '').split('?')[0][-50:]) for e in el[:2]]}
    return {'none': True, 'len': len(t)}
base = 'https://openshop.uz/shop/category/4-maishiy-texnika?lang=ru'
for q in ['', '&page=2', '&page=10', '&p=2', '&limit=100', '&per_page=100', '&page=2&limit=48']:
    try: res[q or 'p1'] = items(base + q)
    except Exception as e: res[q] = repr(e)[:150]
t = requests.get('https://openshop.uz/sitemap/category1.xml', headers=H, timeout=30).text
cats = sorted(set(re.sub(r'\?lang=\w+', '', u) for u in re.findall(r'<loc>([^<]+)</loc>', t)))
res['n_cats'] = len(cats); res['cats'] = cats[:80]
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
