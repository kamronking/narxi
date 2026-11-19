"""Second look: Ishonch shop domains, Glotr catalogue, Goodzone/Elmakon TLS errors."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe22'; os.makedirs(OUT, exist_ok=True); res = {}
def get(name, u, **kw):
    try:
        r = requests.get(u, headers=H, timeout=25, **kw); t = r.text
        open(f'{OUT}/{name}.txt', 'w').write(t[:1500000])
        res[name] = {'u': u, 'st': r.status_code, 'final': r.url[:90], 'len': len(t), 'locs': len(re.findall(r'<loc>', t)),
                     'title': (re.search(r'<title>(.*?)</title>', t, re.S) or [None, ''])[1][:80].strip(),
                     'ld': len(re.findall(r'application/ld\+json', t)), 'price_words': len(re.findall(r"so'm|сум|sum", t))}
        return t
    except Exception as e:
        res[name] = {'u': u, 'err': repr(e)[:400]}; return ''
for d in ['ishonch.shop', 'ishonchsavdo.uz', 'shop.ishonch.uz', 'ishonch.com.uz', 'ishonch-market.uz', 'ishonchmarket.uz', 'ishonch.store']:
    get('ish_' + d, f'https://{d}/')
sm = get('glotr_sm', 'https://glotr.uz/sitemap.xml'); res['glotr_sm_locs'] = re.findall(r'<loc>(.*?)</loc>', sm)[:16]
get('glotr_home', 'https://glotr.uz/')
for d in ['goodzone.uz', 'elmakon.uz']:
    get(d + '_https', f'https://{d}/')
    get(d + '_www', f'https://www.{d}/')
    get(d + '_http', f'http://{d}/', allow_redirects=False)
print('JSONSTART'); print(json.dumps(res, ensure_ascii=False)); print('JSONEND')
