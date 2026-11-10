"""Deep probe of 7 candidate stores: sample category/product pages, sitemaps, JSON APIs. Honest UA, robots respected."""
import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scrape import get, allowed
OUT = 'docs/data/probe9'; os.makedirs(OUT, exist_ok=True)
res = {}
def g(k, url, n=1500000):
    try:
        if not allowed(url): res[k] = {'url': url, 'robots': 'disallow'}; return ''
        r = get(url); t = r.text
        open(f'{OUT}/{k}', 'w').write(t[:n])
        res[k] = {'url': url, 'st': r.status_code, 'len': len(t), 'ct': r.headers.get('content-type'), 'ld': t.count('application/ld+json'),
                  'next': '__NEXT_DATA__' in t, 'nuxt': '__NUXT' in t, 'locs': t.count('<loc>'), 'sum': len(re.findall(r'сум|so.m|UZS', t))}
        return t if r.status_code == 200 else ''
    except Exception as e:
        res[k] = {'url': url, 'err': repr(e)[:200]}; return ''
locs = lambda t: re.findall(r'<loc>\s*([^<\s]+)', t)
# maxcom
t = g('maxcom_sm_products.xml', 'https://maxcom.uz/sitemap/products'); L = locs(t); res['maxcom_n'] = len(L); res['maxcom_sample'] = L[:5]
t = g('maxcom_sm_categories.xml', 'https://maxcom.uz/sitemap/categories'); C = locs(t); res['maxcom_cats'] = C[:40]
if L: g('maxcom_product.html', L[len(L) // 2])
if C: g('maxcom_cat.html', C[min(5, len(C) - 1)])
# woot
h = open('docs/data/probe8/woot.uz.html').read()
wl = sorted(set(re.findall(r'href="(https://(?:www\.)?woot\.uz/[a-z0-9\-/]+/)"', h)))
res['woot_links'] = wl[:80]
cat = next((l for l in wl if re.search(r'smartfon|telefon|televiz|noutbuk', l)), wl[0] if wl else None)
if cat:
    t = g('woot_cat.html', cat); pl = sorted(set(re.findall(r'href="(https://(?:www\.)?woot\.uz/[a-z0-9\-/]+\.html)"', t)))[:5]; res['woot_prod_links'] = pl
    if pl: g('woot_product.html', pl[0])
# avtech
t = g('avtech_sm.xml', 'https://avtech.uz/sitemap.xml'); L = locs(t)
from collections import Counter
res['avtech_patterns'] = Counter(re.sub(r'https://avtech\.uz/([^/]+).*', r'\1', u) for u in L).most_common(15)
prod = next((u for u in L if '/product' in u), None); catu = next((u for u in L if '/catalog' in u or '/category' in u), None)
res['avtech_samples'] = [prod, catu]
if prod: g('avtech_product.html', prod)
if catu: g('avtech_cat.html', catu)
# mionline
t = g('mi_sm_products.xml', 'https://mionline.uz/jetsitemap-products-lang-ru.xml'); L = locs(t); res['mi_n'] = len(L); res['mi_sample'] = L[:4]
if L: g('mi_product.html', L[3])
t = g('mi_sm_cats.xml', 'https://mionline.uz/jetsitemap-categories-lang-ru.xml'); C = locs(t); res['mi_cats'] = C[:30]
if C: g('mi_cat.html', C[0])
# tezz
for k, u in [('tezz_map.xml', 'https://tezz.uz/map.xml'), ('tezz_ddd.xml', 'https://tezz.uz/ddd.php?sitemap.xml')]:
    t = g(k, u); res[k + '_sample'] = locs(t)[:8]
h = g('tezz_home.html', 'https://tezz.uz/')
res['tezz_api_hints'] = sorted(set(re.findall(r'["\'](https?://[^"\']*api[^"\']*|/api/[^"\']+)["\']', h)))[:30]
res['tezz_scripts'] = re.findall(r'<script[^>]+src="([^"]+)"', h)[:20]
# idea
h = g('idea_home.html', 'https://idea.uz/')
js = [s for s in re.findall(r'src="(/_next/static/[^"]+\.js)"', h)][:30]; hits = set()
for s in js:
    try:
        t = get('https://idea.uz' + s).text
        hits |= set(re.findall(r'["`](https://api\.idea\.uz[^"`]*|/api/v\d[^"`]{0,80})["`]', t))
    except Exception as e: pass
res['idea_api_hints'] = sorted(hits)[:80]
nd = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', h, re.S); res['idea_next_keys'] = list(json.loads(nd.group(1)).get('props', {}).get('pageProps', {}).keys())[:30] if nd else None
for k, u in [('idea_api_products', 'https://api.idea.uz/api/v2/products?page=1'), ('idea_api_categories', 'https://api.idea.uz/api/v2/categories')]:
    g(k, u, 300000)
# karcher (Shopify)
g('karcher_products.json', 'https://karcher.uz/products.json?limit=3', 200000)
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
