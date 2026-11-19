"""Ishonch online store: ecom.ishonchsavdo.uz structure."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe23'; os.makedirs(OUT, exist_ok=True); res = {}
B = 'https://ecom.ishonchsavdo.uz'
def get(name, u):
    try:
        r = requests.get(u, headers=H, timeout=30); t = r.text
        open(f'{OUT}/{name}.txt', 'w').write(t[:2000000])
        res[name] = {'u': u, 'st': r.status_code, 'final': r.url[:100], 'ct': r.headers.get('content-type'), 'len': len(t), 'locs': len(re.findall(r'<loc>', t)),
                     'ld': len(re.findall(r'application/ld\+json', t)), 'next': ('__next_f' in t) or ('__NEXT_DATA__' in t), 'nuxt': '__NUXT__' in t,
                     'challenge': bool(re.search(r'Just a moment|cf-chl|captcha', t, re.I)), 'title': (re.search(r'<title>(.*?)</title>', t, re.S) or [None, ''])[1][:80]}
        return t
    except Exception as e:
        res[name] = {'u': u, 'err': repr(e)[:300]}; return ''
res['robots_txt'] = get('robots', B + '/robots.txt')[:800]
sm = get('sitemap', B + '/sitemap.xml'); locs = re.findall(r'<loc>(.*?)</loc>', sm); res['sm_sample'] = locs[:25]
for i, l in enumerate([l for l in locs if '.xml' in l][:3]):
    t = get(f'sub{i}', l); res[f'sub{i}_sample'] = re.findall(r'<loc>(.*?)</loc>', t)[:10]; res[f'sub{i}_n'] = len(re.findall(r'<loc>', t))
h = get('home', B + '/')
res['home_links'] = sorted(set(re.findall(r'href="(/[^"#?]+)"', h)))[:80]
res['api_hints'] = sorted(set(re.findall(r'https?://[a-z0-9.-]*ishonch[a-z0-9.-]*[^"\'\s]{0,60}', h)))[:30]
print('JSONSTART'); print(json.dumps(res, ensure_ascii=False)); print('JSONEND')
