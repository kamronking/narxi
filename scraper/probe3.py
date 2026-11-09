# Survey Uzbek online stores: reachability for an honest bot, robots.txt, bot protection, structured data.
import json, re, os, sys, time, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H, UA
import urllib.robotparser as rp
OUT = 'docs/data/probe4'; os.makedirs(OUT, exist_ok=True)
SITES = ['uzum.uz','olcha.uz','texnomart.uz','mediapark.uz','asaxiy.uz','alifshop.uz','idea.uz','elmakon.uz','goodzone.uz','glotr.uz',
 'ishonch.uz','artelstore.uz','artel.uz','sello.uz','zoodmall.uz','bemarket.uz','macbro.uz','market.yandex.uz','wildberries.uz','ozon.uz',
 'technopark.uz','allgood.uz','imac.uz','mimax.uz','xiaomi-store.uz','samsungstore.uz','birbir.uz','tovar.uz','mobilestore.uz','smartmarket.uz',
 'savdo.uz','shop.uz','planeta.uz','gold-store.uz','uzexpress.uz','next.uz','oltin.uz','telefon.uz','beemarket.uz','avtech.uz']
def sig(r):
    t = r.text[:200000]; h = {k.lower(): v for k, v in r.headers.items()}
    prot = []
    if 'cf-mitigated' in h or 'just a moment' in t.lower() or 'cf-chl' in t: prot.append('cloudflare-challenge')
    if 'captcha' in t.lower(): prot.append('captcha')
    if 'ddos-guard' in t.lower() or 'ddos-guard' in h.get('server', '').lower(): prot.append('ddos-guard')
    if 'qrator' in h.get('server', '').lower(): prot.append('qrator')
    if r.status_code in (401, 403, 429, 503): prot.append(f'http{r.status_code}')
    return {'status': r.status_code, 'len': len(r.text), 'server': h.get('server'), 'prot': prot,
            'jsonld': len(re.findall(r'application/ld\+json', t)), 'product_ld': len(re.findall(r'"@type"\s*:\s*"(?:Product|ItemList|Offer)"', t)),
            'nuxt': '__NUXT__' in t, 'next': '__NEXT_DATA__' in t, 'prices': len(re.findall(r'\d[\d\s]{4,}\s*(?:сум|so.m|uzs)', t, re.I)),
            'final': r.url}
res = {}
for d in SITES:
    e = {}
    for path, k in [('/robots.txt', 'robots'), ('/', 'home'), ('/sitemap.xml', 'sitemap')]:
        url = f'https://{d}{path}'
        try:
            r = requests.get(url, headers=H, timeout=20); time.sleep(1)
            e[k] = sig(r)
            if k == 'robots':
                e['robots_txt'] = r.text[:3000] if r.status_code == 200 else ''
                p = rp.RobotFileParser(); p.parse(r.text.splitlines() if r.status_code == 200 else [])
                e['allow_root'] = p.can_fetch(UA, f'https://{d}/'); e['allow_all_ua_disallowed'] = bool(re.search(r'(?im)^user-agent:\s*\*\s*\n\s*disallow:\s*/\s*$', r.text))
            if k == 'home' and r.status_code == 200:
                open(f'{OUT}/{d}.html', 'w').write(r.text[:300000])
            if k == 'sitemap' and r.status_code == 200:
                e['sitemap_locs'] = re.findall(r'<loc>([^<]+)</loc>', r.text)[:40]
        except Exception as ex:
            e[k] = {'error': repr(ex)[:160]}
    res[d] = e
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
