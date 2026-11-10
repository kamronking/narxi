import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scrape import get, allowed
OUT = 'docs/data/probe10'; os.makedirs(OUT, exist_ok=True); res = {}
def g(k, url):
    try:
        if not allowed(url): res[k] = 'disallow'; return ''
        r = get(url); open(f'{OUT}/{k}', 'w').write(r.text[:1500000]); res[k] = [url, r.status_code, len(r.text), r.url]; return r.text
    except Exception as e: res[k] = repr(e)[:200]; return ''
h = g('woot_home.html', 'https://www.woot.uz/')
res['woot_menu'] = sorted(set(re.findall(r'href="(https://www\.woot\.uz/[a-z0-9\-]+/(?:[a-z0-9\-]+/)?)"[^>]*>\s*([^<]{3,40})<', h)))[:200]
for k, u in [('woot_phones.html', 'https://www.woot.uz/smartfony/'), ('woot_tv.html', 'https://www.woot.uz/televizory/'), ('woot_nb.html', 'https://www.woot.uz/noutbuki/'),
             ('tezz_fridges.html', 'https://tezz.uz/catalog/krupnobytovaya-tehnika/holodilniki'), ('tezz_fridges_p2.html', 'https://tezz.uz/catalog/krupnobytovaya-tehnika/holodilniki?page=2'),
             ('tezz_product.html', 'https://tezz.uz/product/gc-b459seum-103133'),
             ('mi_cat_p2.html', 'https://mionline.uz/smartfony-i-gadzhety/smartfony/?page=2'), ('mi_cat_phones.html', 'https://mionline.uz/smartfony-i-gadzhety/smartfony/'),
             ('maxcom_tv_p2.html', 'https://maxcom.uz/catalog/tv?page=2'), ('avtech_nb_p2.html', 'https://avtech.uz/catalog/noutbuki?page=2'), ('avtech_nb.html', 'https://avtech.uz/catalog/noutbuki')]:
    g(k, u)
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
