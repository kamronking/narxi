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

# ---------------- categories ----------------
# id: (uz, ru, texnomart parent slugs, olcha category-name regex)
CATS = {
 'phones':   ("Smartfonlar", "Смартфоны", ['smartfony'], r'смартфон'),
 'laptops':  ("Noutbuklar", "Ноутбуки", ['noutbuki'], r'ноутбук'),
 'tablets':  ("Planshetlar", "Планшеты", ['planshety'], r'планшет'),
 'tv':       ("Televizorlar", "Телевизоры", ['televizory'], r'телевизор'),
 'monitors': ("Monitorlar", "Мониторы", ['monitory'], r'монитор'),
 'audio':    ("Quloqchin va kolonkalar", "Наушники и колонки", ['naushniki', 'bluetooth-kolonki', 'kompyuternye-kolonki'], r'наушник|колонк|гарнитур|саундбар'),
 'watches':  ("Smart soatlar", "Смарт-часы", ['smart-chasy'], r'смарт.?час|умные час|фитнес'),
 'fridges':  ("Muzlatgichlar", "Холодильники", ['holodilniki', 'morozilniki'], r'холодильн|морозил'),
 'washers':  ("Kir yuvish mashinalari", "Стиральные машины", ['stiralnaja-mashina', 'sushilnye-mashiny'], r'стиральн|сушильн'),
 'ac':       ("Konditsionerlar", "Кондиционеры", ['kondicionery'], r'кондиционер'),
 'home':     ("Changyutgich va dazmollar", "Пылесосы и утюги", ['pylesosy', 'utyugi'], r'пылесос|утюг|отпаривател|парогенератор'),
 'kitchen':  ("Kichik oshxona texnikasi", "Техника для кухни", ['mikrovolnovye-pechi', 'multivarki', 'elektrochainiki', 'blender', 'kofemashiny-i-kofevarki', 'myasorubki', 'tostery', 'miksery', 'sokovyzhimalki', 'gril', 'hlebopechi', 'parovarki'],
              r'микроволн|мультивар|чайник|блендер|кофе|мясоруб|тостер|миксер|соковыжим|гриль|хлебопеч|пароварк|аэрогрил|фритюр|кухонн\w* комбайн'),
 'stoves':   ("Plita va o'rnatiladigan", "Плиты и встройка", ['gazovye-plity', 'duhovki', 'varochnye-paneli', 'vytyazhki', 'posudomoechnye-mashiny'], r'плит|духов|варочн|вытяжк|посудомо'),
 'climate':  ("Isitgich va ventilyatorlar", "Климат", ['obogrevateli', 'ventilyatory', 'vodonagrevateli', 'uvlazhniteli-vozduha'], r'обогрев|вентилятор|водонагрев|увлажн|очистител'),
 'care':     ("Go'zallik texnikasi", "Красота и уход", ['feny', 'vypryamiteli-dlya-volos', 'trimmeri', 'elektrobritvy'], r'\bфен|выпрями|триммер|бритв|эпилят|стайлер|плойк'),
 'printers': ("Printerlar", "Принтеры", ['printery-i-mfu'], r'принтер|мфу'),
}
CAT_RE = [(cid, re.compile(v[3], re.I)) for cid, v in CATS.items()]
def cat_of_name(n):
    n = (n or '').lower()
    for cid, r in CAT_RE:
        if r.search(n):
            return cid
    return 'other'

LATIN_COLORS = r'^(black|white|blue|green|red|pink|purple|gold|silver|gray|grey|graphite|titanium|beige|brown|navy|mint|cream|ivory|inox|dark|light|matte)$'
GENERIC = r'^(smart|tv|led|qled|oled|uhd|hd|fhd|full|ultra|4k|8k|wifi|wi|fi|android|google|webos|tizen|inverter|new|black|white|series|pro|plus|max|mini|lite|air|nfc|bt|bluetooth|wireless|eu|ru|uz|global|version|edition|dual|sim|the|and|for|with|in|led|lcd)$'
def gen_key(cat, title):
    t = title.lower().replace('ё', 'е')
    toks = re.findall(r'[a-z0-9]+(?:[-.][a-z0-9]+)*', t)
    toks = [x for x in toks if not re.match(LATIN_COLORS, x)]
    codes = sorted({re.sub(r'[-/.]', '', x) for x in toks if re.search(r'[a-z]', x) and re.search(r'\d', x) and len(re.sub(r'[-/.]', '', x)) >= 4 and not re.match(r'^(\d+(gb|tb|w|l|kg|hz|mah|btu|mm|cm|inch|ssd|hdd|ddr\d?))+$', re.sub(r'[-/.]', '', x))})
    mem = sorted(set(re.findall(r'(?<![a-z0-9])(\d+)\s*(?:gb|tb|гб|тб)', t)))
    brand = next((x for x in toks if re.match(r'^[a-z]{2,}$', x) and not re.match(GENERIC, x)), '')
    if codes:
        return f"{cat}:{brand}:{'+'.join(codes)}" + (':' + '-'.join(mem) if mem else '')
    words = [x for x in toks if not re.match(GENERIC, x)]
    if len(words) < 2:
        return None
    return f"{cat}:t:" + ' '.join(words)

def clean_name(title):
    n = re.sub(r'\s+', ' ', title).strip()
    n = re.sub(COLORS, '', n, flags=re.I)
    return re.sub(r'\s+', ' ', n).strip(' ,-')

# ---------------- stores ----------------
def tm_list(slug, rep, cap=80):
    items = []; seen_first = None
    for page in range(1, cap):
        url = f'https://texnomart.uz/ru/katalog/{slug}/' + (f'?page={page}' if page > 1 else '')
        try:
            r = get(url)
        except Exception as e:
            rep['errors'].append(f'{url}: {e!r}'[:200]); break
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
        if not got or seen_first == got[0]['url']:
            break
        if page == 1:
            seen_first = got[0]['url']
        items += got
    return items

def texnomart():
    rep = {'pages': 0, 'items': 0, 'errors': [], 'per_cat': {}}
    items, seen = [], set()
    for cid, (_, _, slugs, _) in CATS.items():
        n0 = len(items)
        for slug in slugs:
            for it in tm_list(slug, rep):
                if it['url'] in seen:
                    continue
                seen.add(it['url']); it['cat'] = cid; items.append(it)
        rep['per_cat'][cid] = len(items) - n0
    rep['items'] = len(items)
    rep['errors'] = rep['errors'][:30]
    return items, rep

def olcha():
    rep = {'pages': 0, 'items': 0, 'errors': [], 'per_cat': {}}
    items, seen = [], set()
    page, last = 1, 1
    while page <= last and page < 600:
        url = f'https://mobile.olcha.uz/api/v2/products?page={page}&per_page=50'
        try:
            r = get(url); d = r.json()
        except Exception as e:
            rep['errors'].append(f'p{page}: {e!r}'[:200])
            if len(rep['errors']) > 8: break
            page += 1; continue
        rep['pages'] += 1
        data = d.get('data') or {}
        last = int((data.get('paginator') or {}).get('last_page') or last)
        for p in data.get('products') or []:
            if p['id'] in seen:
                continue
            seen.add(p['id'])
            price = int(float(p.get('total_price') or 0))
            if not price:
                continue
            catname = (p.get('category') or {}).get('name_ru') or ''
            old = int(float(p.get('max_price') or 0)) or None
            items.append({'store': 'olcha', 'title': p.get('name_ru') or p.get('name'), 'price': price,
                          'old': old if old and old > price else None, 'cat': cat_of_name(catname), 'ocat': catname,
                          'url': f"https://olcha.uz/ru/product/view/{p.get('alias')}",
                          'stock': 'out' if p.get('out_of_stock') is True else ('ok' if (p.get('in_stock') or int(p.get('quantity') or 0) > 0) else 'out'),
                          'inst': int(float(p.get('monthly_repayment') or 0)) or None,
                          'img': p.get('main_image')})
        page += 1
    for it in items:
        rep['per_cat'][it['cat']] = rep['per_cat'].get(it['cat'], 0) + 1
    rep['items'] = len(items)
    rep['in_stock'] = sum(1 for i in items if i['stock'] == 'ok')
    return items, rep

STORES = {'texnomart': texnomart, 'olcha': olcha}

def key_for(it):
    if it['cat'] == 'phones':
        k = model_key(it['title'])
        return ('phones:' + k) if k else None
    return gen_key(it['cat'], it['title'])

def main():
    all_items = []
    for sid, fn in STORES.items():
        try:
            items, rep = fn()
        except Exception as e:
            items, rep = [], {'fatal': repr(e)}
        REPORT['stores'][sid] = rep
        all_items += items
    groups, unkeyed = {}, []
    for it in all_items:
        k = key_for(it)
        if not k:
            unkeyed.append(it['title']); continue
        g = groups.setdefault(k, {'key': k, 'cat': it['cat'], 'offers': {}})
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
            offers = [o for o in offers if o['price'] >= hi * 0.55]
        if g['cat'] == 'phones':
            name = min((cut_name(o['title']) for o in offers), key=len)
            name = pretty(re.sub(r'\s+', ' ', re.sub(COLORS, '', name, flags=re.I)))
        else:
            name = clean_name(sorted(offers, key=lambda o: (o['store'] != 'texnomart', len(o['title'])))[0]['title'])
        imgs = [o.get('img') for o in sorted(offers, key=lambda o: o['store'] != 'texnomart') if o.get('img')]
        for o in offers:
            for f in ('img', 'cat', 'ocat'):
                o.pop(f, None)
        products.append({'key': g['key'], 'cat': g['cat'], 'name': name, 'img': imgs[0] if imgs else None, 'offers': sorted(offers, key=lambda o: o['price'])})
    products.sort(key=lambda p: (-len(p['offers']), p['name']))
    V2 = OUT / 'v2'; (V2 / 'c').mkdir(parents=True, exist_ok=True); (V2 / 'h').mkdir(parents=True, exist_ok=True)
    cutoff = (NOW - dt.timedelta(days=150)).strftime('%Y-%m-%d')
    def live_of(p): return [o for o in p['offers'] if o['stock'] == 'ok']
    def gap(p):
        l = live_of(p)
        if len(l) < 2: return 0
        hi, lo = max(o['price'] for o in l), min(o['price'] for o in l)
        return hi - lo if hi - lo < hi * 0.3 else 0
    bycat = {}
    for p in products:
        bycat.setdefault(p['cat'], []).append(p)
    # old phone history migration
    oldh = json.loads((OUT / 'history.json').read_text()) if (OUT / 'history.json').exists() else {}
    cats_meta, idx = [], []
    for cid, ps in bycat.items():
        hp = V2 / 'h' / f'{cid}.json'
        hist = json.loads(hp.read_text()) if hp.exists() else {}
        if cid == 'phones' and not hist:
            hist = {'phones:' + k: v for k, v in oldh.items()}
        for p in ps:
            day = hist.setdefault(p['key'], {}).setdefault(TODAY, {})
            for o in live_of(p):
                day[o['store']] = min(o['price'], day.get(o['store'], 10**12))
        for k in list(hist):
            hist[k] = {d: v for d, v in hist[k].items() if d >= cutoff}
            if not hist[k]: del hist[k]
        hp.write_text(json.dumps(hist, ensure_ascii=False, separators=(',', ':')))
        (V2 / 'c' / f'{cid}.json').write_text(json.dumps(ps, ensure_ascii=False, separators=(',', ':')))
        uz, ru = (CATS[cid][0], CATS[cid][1]) if cid in CATS else ("Boshqa", "Другое")
        top = max(ps, key=lambda p: (len(live_of(p)), bool(p['img'])))
        cats_meta.append({'id': cid, 'uz': uz, 'ru': ru, 'n': len(ps), 'n2': sum(1 for p in ps if len(live_of(p)) > 1), 'img': top['img']})
        for p in ps:
            l = live_of(p)
            idx.append([p['key'], p['name'], cid, min(o['price'] for o in l), len(l), gap(p)])
    order = list(CATS) + ['other']
    cats_meta.sort(key=lambda c: order.index(c['id']) if c['id'] in order else 99)
    deals = sorted([p for p in products if gap(p) > 0], key=lambda p: -gap(p))[:60]
    meta = {'updated': NOW.isoformat(timespec='minutes'),
            'stores': {s: {'items': r.get('items', 0), 'ok': bool(r.get('items'))} for s, r in REPORT['stores'].items()},
            'cats': cats_meta, 'deals': deals, 'idx': idx}
    (V2 / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    # legacy phone files (old app versions)
    phones = [dict(p, key=p['key'][7:]) for p in bycat.get('phones', [])]
    (OUT / 'latest.json').write_text(json.dumps({'updated': meta['updated'], 'stores': meta['stores'], 'products': phones}, ensure_ascii=False, separators=(',', ':')))
    REPORT['products'] = len(products)
    REPORT['matched_2plus'] = sum(1 for p in products if len(live_of(p)) > 1)
    REPORT['cats'] = {c['id']: [c['n'], c['n2']] for c in cats_meta}
    REPORT['unkeyed_sample'] = unkeyed[:15]
    REPORT['keys_sample'] = {cid: [p['key'] + ' :: ' + ' | '.join(f"{o['store']} {o['price']} {o['title'][:50]}" for o in p['offers']) for p in ps if len(p['offers']) > 1][:12] for cid, ps in bycat.items()}
    (OUT / 'report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1))
    print(json.dumps({k: v for k, v in REPORT.items() if k != 'keys_sample'}, ensure_ascii=False)[:3000])

if __name__ == '__main__':
    main()
