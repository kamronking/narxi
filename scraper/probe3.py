"""Dry-run the new openshop adapter and see how many of its products match models already on Narxi."""
import json, os, sys, glob, collections
sys.path.insert(0, os.path.dirname(__file__))
import scrape
OUT = 'docs/data/probe16'; os.makedirs(OUT, exist_ok=True)
items, rep = scrape.openshop()
have = set()
for f in glob.glob('docs/data/v2/c/*.json'):
    for p in json.load(open(f)): have.add(p['key'])
keys = [(scrape.key_for(it), it) for it in items]
match = [(k, it) for k, it in keys if k and k in have]
out = {'rep': rep, 'n': len(items), 'cats': collections.Counter(it['cat'] for it in items).most_common(),
       'stock': collections.Counter(it['stock'] for it in items), 'matched': len(match),
       'matched_by_cat': collections.Counter(k.split(':')[0] for k, _ in match).most_common(),
       'ex_match': [(k, it['title'], it['price']) for k, it in match[:25]],
       'ex_items': [(it['cat'], it['title'], it['price'], it['stock']) for it in items[:25]]}
json.dump(out, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1, default=str)
print(json.dumps({k: out[k] for k in ('n', 'cats', 'stock', 'matched', 'matched_by_cat')}, ensure_ascii=False, default=str))
