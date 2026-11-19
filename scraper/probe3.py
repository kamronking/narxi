"""Which new stores let a polite bot in? robots.txt, home, sitemap, Cloudflare challenge."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe20'; os.makedirs(OUT, exist_ok=True); res = {}
SITES = ['asaxiy.uz', 'mediapark.uz', 'goodzone.uz', 'elmakon.uz', 'uzum.uz', 'ishonch.uz', 'glotr.uz', 'texnohouse.uz', 'artelshop.uz', 'samsungstore.uz']
for d in SITES:
    r0 = {}
    for name, path in [('robots', '/robots.txt'), ('home', '/'), ('sitemap', '/sitemap.xml')]:
        u = f'https://{d}{path}'
        try:
            r = requests.get(u, headers=H, timeout=25)
            t = r.text
            r0[name] = {'st': r.status_code, 'final': r.url[:80], 'len': len(t), 'locs': len(re.findall(r'<loc>', t)),
                        'ldjson': len(re.findall(r'application/ld\+json', t)), 'next': '__next_f' in t or '__NEXT_DATA__' in t,
                        'challenge': bool(re.search(r'Just a moment|cf-chl|captcha|Attention Required|ddos-guard', t, re.I)),
                        'head': t[:300] if name == 'robots' else ''}
        except Exception as e:
            r0[name] = {'err': repr(e)[:120]}
    res[d] = r0
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
