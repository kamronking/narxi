"""Why does mionline return 0 categories now?"""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H, allowed
OUT = 'docs/data/probe17'; os.makedirs(OUT, exist_ok=True); res = {}
for u in ['https://mionline.uz/robots.txt', 'https://mionline.uz/jetsitemap-categories-lang-ru.xml', 'https://mionline.uz/sitemap.xml', 'https://mionline.uz/']:
    try:
        r = requests.get(u, headers=H, timeout=25)
        res[u] = {'st': r.status_code, 'final': r.url, 'ct': r.headers.get('content-type'), 'allowed': allowed(u), 'len': len(r.text), 'head': r.text[:900],
                  'locs': len(re.findall(r'<loc>', r.text)), 'challenge': bool(re.search(r'challenge|captcha|Just a moment', r.text, re.I))}
    except Exception as e:
        res[u] = {'err': repr(e)[:200]}
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
