"""Narxi price robot.

Collects smartphone prices from stores that allow it (robots.txt respected, honest bot name),
groups the same model across stores, and keeps a daily price history.
Outputs (served by GitHub Pages):
  docs/data/latest.json   - current offers grouped by model
  docs/data/history.json  - {model_key: {date: {store: price}}}
  docs/data/report.json   - what the robot saw (for debugging)
"""
import json, re, time, datetime as dt, pathlib, urllib.robotparser as rp
import requests

UA = 'NarxiBot/0.1 (+https://github.com/kamronking/narxi; price comparison)'
H = {'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9'}
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'data'
OUT.mkdir(parents=True, exist_ok=True)
TZ = dt.timezone(dt.timedelta(hours=5))
NOW = dt.datetime.now(TZ)
TODAY = NOW.strftime('%Y-%m-%d')
REPORT = {'started': NOW.isoformat(), 'stores': {}}
DELAY = 1.2

_robots = {}
def allowed(url):
    host = re.match(r'https?://[^/]+', url).group(0)
    if host not in _robots:
        r = rp.RobotFileParser()
        try:
            resp = requests.get(host + '/robots.txt', headers=H, timeout=20)
            r.parse(resp.text.splitlines() if resp.status_code == 200 else [])
        except Exception:
            r.parse([])
        _robots[host] = r
    return _robots[host].can_fetch(UA, url)

def get(url, **kw):
    if not allowed(url):
        raise PermissionError('robots.txt disallows ' + url)
    time.sleep(DELAY)
    return requests.get(url, headers=H, timeout=30, **kw)

# ---------------- model key normalisation ----------------
COLORS = r'(?<![a-zа-я0-9])(черн\w*|бел\w*|сер\w*|сини\w*|син\w*|голуб\w*|зел\w*|красн\w*|розов\w*|фиолет\w*|золот\w*|желт\w*|оранж\w*|бирюз\w*|graphite|black|white|blue|green|red|pink|purple|gold|silver|gray|grey|titanium|natural|desert|teal|ultramarine|midnight|starlight|space|cosmic|deep|sky|night|star|lavender|mint|cream|coral|navy|violet|yellow|orange|космическ\w*|глубок\w*|небесн\w*|натурал\w*|титан\w*|пустын\w*)(?![a-zа-я0-9])'
DROP = r'\b(смартфон|телефон|мобильный|сотовый|apple|global|version|ru|eac|esim|sim|dual|nfc|new|новый)\b'

def storage(t):
    t = t.replace('тб', 'tb').replace('гб', 'gb')
    sizes = {x for x in re.findall(r'(?<!\d)(32|64|128|256|512|1024)(?!\d)', t)}
    if re.search(r'(?<!\d)(64|128|256|512)\s*/\s*(128|256|512|1)\s*(gb|tb)', t) or len(sizes) > 1:
        return None, None, -1, -1  # several storage options in one title -> ambiguous
    m = re.search(r'(?<!\d)(\d{1,2})\s*/\s*(\d{2,4}|1)\s*(gb|tb)?', t)
    if m:
        ram, st = m.group(1), m.group(2)
        st = '1024' if (m.group(3) == 'tb' or st == '1') else st
        return ram, st, m.start(), m.end()
    m = re.search(r'(\d{2,4}|1|2)\s*(gb|tb)', t)
    if m:
        st = str(int(m.group(1)) * 1024) if m.group(2) == 'tb' else m.group(1)
        if int(st) >= 32:
            return None, st, m.start(), m.end()
    return None, None, -1, -1

def model_key(name):
    t = name.lower().replace('ё', 'е')
    t = re.sub(r'[“”"«»(),]', ' ', t)
    ram, st, a, b = storage(t)
    base = t[:a] if a >= 0 else t
    base = re.sub(DROP, ' ', base)
    base = re.sub(COLORS, ' ', base)
    base = re.sub(r'\b5g\b|\b4g\b', ' ', base)
    base = re.sub(r'[^a-zа-я0-9+ ]', ' ', base)
    base = re.sub(r'\s+', ' ', base).strip()
    if not base or not st:
        return None
    return f'{base} {st}gb'

def cut_name(title):
    low = re.sub(r'[“”"«»(),]', ' ', title.lower().replace('ё', 'е')).replace('тб', 'tb').replace('гб', 'gb')
    _, st, a, b = storage(low)
    return title[:b].strip() if st and b > 0 else title

def pretty(name):
    n = re.sub(r'\s+', ' ', name).strip()
    n = re.sub(r'(?i)^смартфон\s+', '', n)
    return n

# ---------------- stores ----------------
def texnomart():
    rep = {'pages': 0, 'items': 0, 'errors': []}
    items = []
    for cat in ['smartfony']:
        seen_first = None
        for page in range(1, 60):
            url = f'https://texnomart.uz/ru/katalog/{cat}/' + (f'?page={page}' if page > 1 else '')
            try:
                r = get(url)
            except Exception as e:
                rep['errors'].append(f'{url}: {e!r}'); break
            if r.status_code != 200:
                rep['errors'].append(f'{url}: HTTP {r.status_code}'); break
            got = []
            for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', r.text, re.S):
                try:
                    d = json.loads(block)
                except Exception:
                    continue
                for x in (d if isinstance(d, list) else [d]):
                    if isinstance(x, dict) and x.get('@type') == 'ItemList':
                        for it in x.get('itemListElement', []):
                            p = it.get('item', {}); o = p.get('offers') or {}
                            if not p.get('name') or not o.get('price'):
                                continue
                            got.append({'store': 'texnomart', 'title': p['name'], 'price': int(float(o['price'])),
                                        'old': None, 'url': p.get('url'), 'stock': 'ok' if 'InStock' in str(o.get('availability')) else 'out',
                                        'img': (p.get('image')[0] if isinstance(p.get('image'), list) else p.get('image'))})
            rep['pages'] += 1
            if not got:
                break
            if seen_first == got[0]['url']:
                break  # page param ignored -> same list again
            if page == 1:
                seen_first = got[0]['url']
            items += got
    rep['items'] = len(items)
    rep['sample'] = [i['title'] for i in items[:8]]
    return items, rep

def olcha():
    rep = {'pages': 0, 'items': 0, 'errors': []}
    items, seen = [], set()
    for q in ['iphone', 'samsung galaxy', 'xiaomi redmi', 'poco', 'honor', 'tecno', 'realme', 'infinix', 'vivo', 'oppo', 'google pixel', 'nothing phone']:
        for page in range(1, 8):
            url = f'https://mobile.olcha.uz/api/v2/products?q={requests.utils.quote(q)}&page={page}&per_page=50'
            try:
                r = get(url); d = r.json()
            except Exception as e:
                rep['errors'].append(f'{q} p{page}: {e!r}'); break
            rep['pages'] += 1
            prods = (d.get('data') or {}).get('products') or []
            if not prods:
                break
            for p in prods:
                if p['id'] in seen:
                    continue
                seen.add(p['id'])
                catname = ((p.get('category') or {}).get('name_ru') or '').lower()
                if 'смартфон' not in catname and 'телефон' not in catname:
                    continue
                price = int(float(p.get('total_price') or 0))
                if not price:
                    continue
                old = int(float(p.get('max_price') or 0)) or None
                if p.get('discount') and float(p.get('discount_value') or 0) > 0 and not old:
                    old = None
                items.append({'store': 'olcha', 'title': p.get('name_ru') or p.get('name'), 'price': price,
                              'old': old if old and old > price else None,
                              'url': f"https://olcha.uz/ru/product/view/{p.get('alias')}",
                              'stock': 'out' if p.get('out_of_stock') is True else ('ok' if (p.get('in_stock') or int(p.get('quantity') or 0) > 0) else 'out'),
                              'inst': int(float(p.get('monthly_repayment') or 0)) or None,
                              'img': p.get('main_image')})
            pg = (d.get('data') or {}).get('paginator') or {}
            if page >= int(pg.get('last_page') or 1):
                break
    rep['items'] = len(items)
    rep['sample'] = [i['title'] for i in items[:8]]
    rep['in_stock'] = sum(1 for i in items if i['stock'] == 'ok')
    return items, rep

STORES = {'texnomart': texnomart, 'olcha': olcha}

def main():
    all_items = []
    for sid, fn in STORES.items():
        try:
            items, rep = fn()
        except Exception as e:
            items, rep = [], {'fatal': repr(e)}
        REPORT['stores'][sid] = rep
        all_items += items
    # group
    groups, unkeyed = {}, []
    for it in all_items:
        k = model_key(it['title'])
        if not k:
            unkeyed.append(it['title']); continue
        g = groups.setdefault(k, {'key': k, 'name': pretty(it['title']), 'offers': {}})
        best = g['offers'].get(it['store'])
        if it['stock'] == 'ok' and (not best or best['stock'] != 'ok' or it['price'] < best['price']):
            g['offers'][it['store']] = it
        elif not best:
            g['offers'][it['store']] = it
    products = []
    for g in groups.values():
        offers = list(g['offers'].values())
        live = [o for o in offers if o['stock'] == 'ok']
        if not live:
            continue
        if len(live) > 1:
            hi = max(o['price'] for o in live)
            offers = [o for o in offers if o['price'] >= hi * 0.55]  # far cheaper = probably another product
        # prefer the cleanest name (texnomart style), drop colour words
        name = min((cut_name(o['title']) for o in offers), key=len)
        name = re.sub(COLORS, '', name, flags=re.I)
        name = pretty(re.sub(r'\s+', ' ', name))
        imgs = [o.get('img') for o in sorted(offers, key=lambda o: o['store'] != 'texnomart') if o.get('img')]
        for o in offers:
            o.pop('img', None)
        products.append({'key': g['key'], 'name': name, 'img': imgs[0] if imgs else None, 'offers': sorted(offers, key=lambda o: o['price'])})
    products.sort(key=lambda p: (-len(p['offers']), p['name']))
    # history
    hp = OUT / 'history.json'
    hist = json.loads(hp.read_text()) if hp.exists() else {}
    for p in products:
        day = hist.setdefault(p['key'], {}).setdefault(TODAY, {})
        for o in p['offers']:
            if o['stock'] == 'ok':
                day[o['store']] = min(o['price'], day.get(o['store'], 10**12))
    cutoff = (NOW - dt.timedelta(days=150)).strftime('%Y-%m-%d')
    for k in list(hist):
        hist[k] = {d: v for d, v in hist[k].items() if d >= cutoff}
        if not hist[k]:
            del hist[k]
    hp.write_text(json.dumps(hist, ensure_ascii=False, separators=(',', ':')))
    latest = {'updated': NOW.isoformat(timespec='minutes'), 'stores': {s: {'items': r.get('items', 0), 'ok': bool(r.get('items'))} for s, r in REPORT['stores'].items()},
              'products': products}
    (OUT / 'latest.json').write_text(json.dumps(latest, ensure_ascii=False, separators=(',', ':')))
    REPORT['products'] = len(products)
    REPORT['matched_2plus'] = sum(1 for p in products if len(p['offers']) > 1)
    REPORT['unkeyed_sample'] = unkeyed[:15]
    REPORT['keys_sample'] = [p['key'] + ' :: ' + ' | '.join(f"{o['store']} {o['price']}" for o in p['offers']) for p in products[:25]]
    (OUT / 'report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1))
    print(json.dumps({k: v for k, v in REPORT.items() if k != 'keys_sample'}, ensure_ascii=False)[:2000])

if __name__ == '__main__':
    main()
