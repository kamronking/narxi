"""Survey candidate stores (public pages only, honest UA): robots.txt, protection, sitemaps, how prices are served."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe12'; os.makedirs(OUT, exist_ok=True); res = {}
C = ['mediapark.uz', 'asaxiy.uz', 'elmakon.uz', 'goodzone.uz', 'uzum.uz', 'artel.uz', 'ishonch.uz', 'glotr.uz', 'openshop.uz', 'sello.uz', 'texnoplus.uz', 'smarts.uz']
for d in C:
    o = {}
    try:
        r = requests.get(f'https://{d}/robots.txt', headers=H, timeout=25)
        o['robots_st'] = r.status_code
        rt = r.text if 'text/plain' in r.headers.get('content-type', '') or r.text.lstrip().lower().startswith(('user-agent', '#', 'sitemap', 'disallow')) else ''
        o['robots'] = rt[:1500]
        o['sitemaps'] = re.findall(r'(?im)^\s*sitemap:\s*(\S+)', rt)[:5]
        h = requests.get(f'https://{d}/', headers=H, timeout=25)
        t = h.text
        o.update({'home_st': h.status_code, 'final': h.url, 'server': h.headers.get('server', ''), 'cf': 'cf-ray' in {k.lower() for k in h.headers},
                  'challenge': bool(re.search(r'challenge-platform|cf-chl|captcha|qrator|ddos-guard|Just a moment', t, re.I)),
                  'title': (re.search(r'<title[^>]*>([^<]*)', t) or [0, ''])[1].strip()[:120], 'len': len(t),
                  'next': '__NEXT_DATA__' in t, 'nuxt': '__NUXT__' in t or '_nuxt/' in t,
                  'prices_in_html': len(re.findall(r'\d[\d\s ]{4,}\s*(?:сум|so[\'ʻ`]?m|UZS)', t, re.I)),
                  'api_hints': sorted(set(re.findall(r'https?://(?:api|back|gw|graphql)[\w.-]*\.[a-z]{2,}', t)))[:6]})
        if o['sitemaps']:
            s = requests.get(o['sitemaps'][0], headers=H, timeout=25)
            o['sitemap_st'] = s.status_code; o['sitemap_head'] = s.text[:600]
    except Exception as e:
        o['err'] = repr(e)[:200]
    res[d] = o
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: {x: v.get(x) for x in ('robots_st', 'home_st', 'cf', 'challenge', 'title', 'prices_in_html', 'next', 'nuxt', 'err')} for k, v in res.items()}, ensure_ascii=False, indent=1))
