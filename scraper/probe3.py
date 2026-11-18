"""Why do mionline (0 categories) and openshop (0 items) fail now? Saves raw responses."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H, allowed
OUT = 'docs/data/probe19'; os.makedirs(OUT, exist_ok=True); res = {}
URLS = {
    'mi_robots': 'https://mionline.uz/robots.txt',
    'mi_jetcat': 'https://mionline.uz/jetsitemap-categories-lang-ru.xml',
    'mi_sitemap': 'https://mionline.uz/sitemap.xml',
    'mi_home': 'https://mionline.uz/',
    'os_robots': 'https://openshop.uz/robots.txt',
    'os_cat': 'https://openshop.uz/shop/category/11-telefonlar-va-planshetlar?lang=ru',
    'os_home': 'https://openshop.uz/',
    'os_sitemap': 'https://openshop.uz/sitemap.xml',
}
for name, u in URLS.items():
    try:
        r = requests.get(u, headers=H, timeout=25)
        t = r.text
        open(f'{OUT}/{name}.txt', 'w').write(t[:1200000])
        res[name] = {'url': u, 'st': r.status_code, 'final': r.url, 'ct': r.headers.get('content-type'), 'allowed': allowed(u), 'len': len(t),
                     'locs': len(re.findall(r'<loc>', t)), 'ldjson': len(re.findall(r'application/ld\+json', t)),
                     'challenge': bool(re.search(r'challenge|captcha|Just a moment|cf-', t, re.I)), 'head': t[:600]}
    except Exception as e:
        res[name] = {'url': u, 'err': repr(e)[:200]}
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
