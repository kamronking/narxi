import json, re, os, sys, time, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import get, allowed, H
OUT = 'docs/data/probe5'; os.makedirs(OUT, exist_ok=True)
res = {}
def g(k, url, save=None):
    try:
        if not allowed(url): res[k] = {'url': url, 'robots': 'disallow'}; return ''
        r = get(url); res[k] = {'url': url, 'st': r.status_code, 'len': len(r.text), 'ct': r.headers.get('content-type')}
        if save: open(f'{OUT}/{save}', 'w').write(r.text[:600000])
        return r.text if r.status_code == 200 else ''
    except Exception as e:
        res[k] = {'url': url, 'err': repr(e)[:200]}; return ''
# Alif
t = g('alif_sm0', 'https://alifshop.uz/0-sitemap.xml', 'alif_sm0.xml'); res['alif_sm0_locs'] = re.findall(r'<loc>([^<]+)', t)[:30]
t = g('alif_sm1', 'https://alifshop.uz/1-sitemap.xml'); res['alif_sm1_locs'] = re.findall(r'<loc>([^<]+)', t)[:10]; res['alif_sm1_n'] = len(re.findall('<loc>', t))
t = g('alif_cat_p2', 'https://alifshop.uz/ru/categories/smartfoni-i-telefoni?page=2', 'alif_p2.html')
res['alif_p2_offers'] = len(re.findall(r'/ru/moderated-offer/', t))
# Beeline
t = g('bee_cat', 'https://market.beeline.uz/smartfony', 'bee_cat.html'); res['bee_cat_names'] = re.findall(r'product-card__name[^>]*>([^<]+)', t)[:5]; res['bee_cat_n'] = len(re.findall('product-card__name', t))
t = g('bee_cat_p2', 'https://market.beeline.uz/smartfony?page=2'); res['bee_p2_names'] = re.findall(r'product-card__name[^>]*>([^<]+)', t)[:3]
res['bee_links'] = sorted(set(re.findall(r'href="(/[^"?#]+)"', t)))[:60]
# Macbro (Shopify)
t = g('mcbro_products', 'https://mcbro.uz/products.json?limit=3', 'mcbro_products.json')
t = g('mcbro_robots', 'https://mcbro.uz/robots.txt', 'mcbro_robots.txt')
# Idea: find API host in JS
t = g('idea_home', 'https://idea.uz/')
srcs = re.findall(r'src="(/_next/static/[^"]+\.js)"', t)[:25]; res['idea_srcs'] = len(srcs); hosts = set()
for s in srcs:
    try:
        r = requests.get('https://idea.uz' + s, headers=H, timeout=20); time.sleep(0.5)
        hosts |= set(re.findall(r'https?://[a-z0-9.\-]*idea[a-z0-9.\-]*\.uz[a-zA-Z0-9/_\-.]*', r.text))
    except Exception: pass
res['idea_hosts'] = sorted(hosts)[:40]
for h in sorted({re.match(r'https?://[^/]+', x).group(0) for x in hosts})[:6]:
    g('robots_' + h, h + '/robots.txt', 'robots_' + re.sub(r'\W', '_', h) + '.txt')
# Avtech
t = g('avtech_cat', 'https://avtech.uz/catalog/naushniki', 'avtech_cat.html')
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', t, re.S)
res['avtech_props'] = (m.group(1)[:1500] if m else None); res['avtech_prices'] = len(re.findall(r'сум', t))
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
