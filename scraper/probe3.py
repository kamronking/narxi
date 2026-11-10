"""Look at competitor homepages (public, honest UA) to verify what they offer."""
import json, re, os, sys, requests
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe11'; os.makedirs(OUT, exist_ok=True); res = {}
for d in ['farq.uz', 'pricehunt.uz', 'maxprofit.uz', 'taqqoz.uz', 'dunno.uz', 'www.dunno.uz', 'kattabozor.uz']:
    try:
        r = requests.get('https://' + d + '/', headers=H, timeout=25)
        t = r.text
        txt = re.sub(r'\s+', ' ', re.sub(r'<script.*?</script>|<style.*?</style>|<[^>]+>', ' ', t, flags=re.S))
        res[d] = {'st': r.status_code, 'final': r.url, 'title': (re.search(r'<title[^>]*>([^<]*)', t) or [0, ''])[1].strip()[:150],
                  'desc': (re.search(r'name="description"[^>]*content="([^"]*)"', t) or [0, ''])[1][:300],
                  'nums': re.findall(r'(\d[\d\s ]{1,9}\+?)\s*(магазин|товар|do\'kon|mahsulot|stores|products)', txt, re.I)[:8],
                  'text': txt[:1500]}
    except Exception as e:
        res[d] = {'err': repr(e)[:200]}
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
