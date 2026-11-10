import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scrape import get, allowed
OUT = 'docs/data/probe7'; os.makedirs(OUT, exist_ok=True)
res = {}
for k, url in {'tm_cat': 'https://texnomart.uz/ru/katalog/holodilniki/', 'tm_prod_list2': 'https://texnomart.uz/ru/katalog/smartfony/'}.items():
    try:
        if not allowed(url): res[k] = 'robots disallow'; continue
        r = get(url); t = r.text
        open(f'{OUT}/{k}.html', 'w').write(t[:1500000])
        res[k] = {'st': r.status_code, 'len': len(t),
                  'hits': {w: len(re.findall(w, t, re.I)) for w in ['monthly', 'loan', 'installment', 'credit', 'oyiga', 'мес', 'month', 'rassrochka', 'nasiya', 'period']},
                  'samples': [t[max(0, m.start()-160):m.end()+120] for m in list(re.finditer(r'monthly|loan_|installment_|month_', t))[:8]]}
    except Exception as e:
        res[k] = repr(e)[:200]
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
