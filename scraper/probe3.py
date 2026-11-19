"""Ishonch product page HTML (price without the API?) + a Glotr category and product."""
import json, re, os, sys, requests, gzip
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe24'; os.makedirs(OUT, exist_ok=True); res = {}
def get(name, u):
    try:
        r = requests.get(u, headers=H, timeout=30); t = r.text
        open(f'{OUT}/{name}.txt', 'w').write(t[:2000000])
        lds = re.findall(r'<script[^>]+ld\+json[^>]*>(.*?)</script>', t, re.S)
        res[name] = {'u': u, 'st': r.status_code, 'len': len(t), 'ld_types': [ (re.search(r'"@type"\s*:\s*"([^"]+)"', b) or [None,'?'])[1] for b in lds],
                     'price_in_html': re.findall(r'"price"\s*:\s*"?([0-9.]+)', t)[:5], 'og_price': re.findall(r'product:price:amount" content="([^"]+)', t)[:3]}
        return t
    except Exception as e:
        res[name] = {'u': u, 'err': repr(e)[:300]}; return ''
get('ish_prod', 'https://ecom.ishonchsavdo.uz/product/kir-yuvish-mashinasi-avtomat-lg-f2t9gw9p-8-5-kg-wet-asphalt-4358ec2a')
r = requests.get('https://glotr.uz/sitemap1.xml.gz', headers=H, timeout=30)
try: t = gzip.decompress(r.content).decode('utf-8', 'ignore')
except Exception: t = r.text
locs = re.findall(r'<loc>(.*?)</loc>', t); res['glotr_sm1_n'] = len(locs); res['glotr_sm1_sample'] = locs[:12]
c = get('glotr_cat', 'https://glotr.uz/noutbuki/')
pl = list(dict.fromkeys(re.findall(r'href="(https://glotr.uz/[^"]+?-\d+/)"', c)))
res['glotr_cat_prod_links'] = pl[:10]; res['glotr_cat_n_links'] = len(pl)
res['glotr_cat_pages'] = sorted(set(re.findall(r'[?&]page=(\d+)', c)))[-3:]
if pl: get('glotr_prod', pl[0])
print('JSONSTART'); print(json.dumps(res, ensure_ascii=False)); print('JSONEND')
