"""openshop: how category listings expose products/prices; elmakon/goodzone: try www. hosts."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe14'; os.makedirs(OUT, exist_ok=True); res = {}
try:
    u = 'https://openshop.uz/shop/category/4-maishiy-texnika?lang=ru'
    r = requests.get(u, headers=H, timeout=30); t = r.text
    res['os_cat'] = {'st': r.status_code, 'len': len(t),
        'prod_links': len(set(re.findall(r'/shop/product/\d+-[\w-]+', t))),
        'prices': re.findall(r'\d[\d\s ]{4,}\s*(?:сум|so[\'ʻ`]?m)', t)[:6],
        'hosts': sorted(set(re.findall(r'https?://[\w.-]*openshop\.uz[\w/.-]{0,40}', t)))[:25],
        'api_like': sorted(set(re.findall(r'["\'](/api/[\w/.-]{2,60}|https?://[\w.-]+/api/[\w/.-]{2,60})', t)))[:20],
        'page_param': sorted(set(re.findall(r'[?&](page|p|offset|limit|per_page)=\d+', t)))[:10],
        'snip': [t[max(0, m.start() - 300):m.end() + 100] for m in re.finditer(r'/shop/product/\d+-', t)][:2]}
    # robots allows /shop?..., try the API host guess
    for g in ['https://api.openshop.uz/', 'https://openshop.uz/api/products?limit=2', 'https://back.openshop.uz/']:
        try:
            q = requests.get(g, headers=H, timeout=15); res.setdefault('os_guess', {})[g] = [q.status_code, q.headers.get('content-type', ''), q.text[:200]]
        except Exception as e:
            res.setdefault('os_guess', {})[g] = repr(e)[:120]
except Exception as e:
    res['os_err'] = repr(e)[:300]
for h in ['www.elmakon.uz', 'www.goodzone.uz', 'elmakon.uz', 'goodzone.uz']:
    try:
        r = requests.get(f'https://{h}/robots.txt', headers=H, timeout=20)
        res[h] = {'st': r.status_code, 'final': r.url, 'robots': r.text[:1200]}
    except Exception as e:
        res[h] = {'err': repr(e)[:220]}
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
