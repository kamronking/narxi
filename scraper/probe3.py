import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scrape import get, allowed, ALIF_RE, ALIF_EXCL, nuxt_revive
OUT = 'docs/data/probe6'; os.makedirs(OUT, exist_ok=True)
res = {}
slugs = set()
for n in (1, 2, 3):
    try: slugs |= set(re.findall(r'https://alifshop.uz/ru/categories/([^<\s/?]+)', get(f'https://alifshop.uz/{n}-sitemap.xml').text))
    except Exception as e: res[f'sm{n}'] = repr(e)
bycat = {}
for sl in sorted(slugs):
    if re.search(ALIF_EXCL, sl): continue
    for cid, rx in ALIF_RE.items():
        if re.search(rx, sl): bycat.setdefault(cid, []).append(sl); break
res['bycat'] = bycat
for cid in ('fridges', 'kitchen', 'home', 'phones'):
    for sl in bycat.get(cid, [])[:3]:
        url = f'https://alifshop.uz/ru/categories/{sl}'
        try:
            r = get(url); t = r.text
            rev, arr = nuxt_revive(t)
            d = {'st': r.status_code, 'len': len(t), 'nuxt': bool(rev), 'final': r.url,
                 'offers_mo': sum(1 for v in arr if isinstance(v, dict) and 'moderated_offer_id' in v),
                 'links_mo': len(re.findall(r'/moderated-offer/', t)),
                 'pag': [{k: (arr[x] if isinstance(x, int) else x) for k, x in v.items()} for v in arr if isinstance(v, dict) and 'last_page' in v][:2],
                 'keysets': sorted({','.join(sorted(v)[:12]) for v in arr if isinstance(v, dict) and 'price' in v})[:6]}
            res[f'{cid}:{sl}'] = d
            if not d['offers_mo']: open(f'{OUT}/{sl}.html', 'w').write(t[:600000])
        except Exception as e: res[f'{cid}:{sl}'] = repr(e)[:200]
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
