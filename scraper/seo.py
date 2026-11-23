"""Static SEO pages: one page per model with live prices, plus category hubs and sitemap.xml.

Runs after scrape.py (see .github/workflows/scrape.yml). Reads docs/data/v2, writes:
  docs/narx/index.html                 all categories
  docs/narx/<cat>/index.html           all models of a category
  docs/narx/<cat>/<slug>/index.html    one model: prices in every store, JSON-LD Product
  docs/sitemap.xml
Google can read these without running the app; each page links into the app (/?p=<key>).
"""
import json, re, html, shutil, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'docs'
DATA = ROOT / 'data' / 'v2'
OUT = ROOT / 'narx'
SITE = 'https://narxi.site'

STORES = {'texnomart': 'Texnomart', 'olcha': 'Olcha', 'alif': 'Alif Shop', 'beeline': 'Beeline Market', 'macbro': 'Macbro',
          'idea': 'Idea', 'maxcom': 'Maxcom', 'woot': 'Woot', 'avtech': 'Avtech', 'mionline': 'Mi Online', 'tezz': 'Tezz',
          'karcher': 'Kärcher', 'openshop': 'OpenShop', 'castore': 'CA Store'}
ALWAYS = {'phones', 'tablets'}          # people search these by model even when one store sells it
MAX_SIMILAR = 8

TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюяўқғҳ',
              ['a', 'b', 'v', 'g', 'd', 'e', 'yo', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'h', 'ts', 'ch',
               'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya', 'o', 'q', 'g', 'h']))

def slugify(s):
    s = ''.join(TR.get(c, c) for c in s.lower())
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s)).strip('-')[:90] or 'model'

def sim_of(t):
    t = (t or '').lower()
    if re.search(r'e-?sim\s*\+\s*e-?sim|dual\s*e-?sim', t): return 'esim'
    if re.search(r'dual\s*sim|2\s*sim|две\s*sim|(^|[^e])sim\s*\+\s*sim', t): return 'dual'
    if re.search(r'nano-?sim|single\s*sim|(^|[^e-])sim\s*\+\s*e-?sim|sim\s*va\s*e-?sim', t): return 'sim'
    if re.search(r'e-?sim', t): return 'esim'
    return None

SIML = {'esim': 'Faqat eSIM', 'sim': 'SIM + eSIM', 'dual': '2 ta SIM', None: "SIM turi ko'rsatilmagan"}

def som(n):
    return f'{int(n):,}'.replace(',', ' ')

e = lambda s: html.escape(str(s or ''), quote=True)

CSS = """*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f5;color:#13201b}
a{color:#0c5a43}.w{max-width:760px;margin:0 auto;padding:16px}header{background:#0c5a43;color:#fff}header .w{display:flex;justify-content:space-between;align-items:center;padding:12px 16px}
header a{color:#fff;text-decoration:none;font-weight:800;font-size:20px}header .go{font-size:14px;font-weight:600;border:1px solid #ffffff80;border-radius:999px;padding:6px 14px}
.bc{font-size:13px;color:#5b6b64;margin:4px 0 10px}.bc a{color:#5b6b64}h1{font-size:26px;line-height:1.2;margin:0 0 6px}.sub{color:#5b6b64;margin:0 0 16px;font-size:14px}
.card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 3px #0000000f;margin-bottom:14px}.top{display:flex;gap:16px;align-items:center}
.top img{width:120px;height:120px;object-fit:contain;flex:none}.best{font-size:14px;color:#5b6b64}.best b{display:block;font-size:28px;color:#0c5a43;line-height:1.2}
.save{display:inline-block;background:#e6f4ee;color:#0c5a43;font-weight:700;font-size:13px;border-radius:999px;padding:3px 10px;margin-top:6px}
table{width:100%;border-collapse:collapse}td{padding:12px 6px;border-top:1px solid #eef0ee;vertical-align:middle}tr:first-child td{border-top:0}
.cn{font-size:13px;color:#5b6b64;background:#f3f5f2;border-radius:10px;padding:8px 10px;margin:-2px 0 8px}.st{font-weight:700}.ot{display:block;font-weight:400;font-size:12px;color:#5b6b64;line-height:1.35;margin-top:2px}.simt{display:inline-block;font-size:11px;font-weight:700;background:#e6f4ee;color:#0c5a43;border-radius:6px;padding:0 6px;margin-right:5px}.pr{text-align:right;white-space:nowrap;font-weight:800}.pr s{display:block;color:#98a29d;font-weight:400;font-size:13px}.pr small{display:block;color:#5b6b64;font-weight:400;font-size:12px}
.lnk{text-align:right;white-space:nowrap}.lnk a{font-size:14px;font-weight:600}.cta{display:block;text-align:center;background:#0c5a43;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px;margin:4px 0 14px}
h2{font-size:18px;margin:0 0 10px}ul.l{list-style:none;padding:0;margin:0}ul.l li{padding:8px 0;border-top:1px solid #eef0ee;display:flex;justify-content:space-between;gap:10px}ul.l li:first-child{border-top:0}
ul.l span{white-space:nowrap;color:#5b6b64;font-size:14px}.ru{font-size:14px;color:#5b6b64}footer{font-size:13px;color:#5b6b64;text-align:center;padding:20px 16px 40px}
@media(max-width:520px){h1{font-size:22px}.top img{width:90px;height:90px}.best b{font-size:24px}.lnk a{font-size:13px}}"""

def page(title, desc, canon, body, ld=None):
    lds = ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in (ld or []))
    return f"""<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{canon}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Narxi"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{canon}">
<meta name="theme-color" content="#0c5a43"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/narx/s.css?v=3">{lds}</head><body>
<header><div class="w"><a href="/">Narxi</a><a class="go" href="/">Barcha narxlar →</a></div></header><main class="w">{body}</main>
<footer>Narxi — O'zbekistondagi onlayn do'konlar narxlarini solishtirish. Narxlar har 3 soatda yangilanadi. · <a href="/narx/">Katalog</a></footer></body></html>"""

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')

def main():
    meta = json.loads((DATA / 'meta.json').read_text())
    upd = meta.get('updated', '')
    try:
        d = datetime.datetime.fromisoformat(upd)
        upd_txt = d.strftime('%d.%m.%Y %H:%M'); day = d.date().isoformat()
    except Exception:
        upd_txt, day = upd, datetime.date.today().isoformat()
    cats = [c for c in meta.get('cats', []) if c['id'] != 'other']

    models = {}  # cat -> list of dicts
    for c in cats:
        f = DATA / 'c' / f"{c['id']}.json"
        if not f.exists():
            continue
        rows, used = [], set()
        for p in json.loads(f.read_text()):
            live = sorted([o for o in p['offers'] if o.get('stock') == 'ok' and o.get('price')], key=lambda o: o['price'])
            # one row per store (cheapest offer of that store)
            seen, offs = set(), []
            for o in live:
                if o['store'] in seen: continue
                seen.add(o['store']); offs.append(o)
            if len(offs) < 2 and not (c['id'] in ALWAYS and offs):
                continue
            slug = slugify(p['key'].split(':', 1)[1])
            base, i = slug, 2
            while slug in used:
                slug = f'{base}-{i}'; i += 1
            used.add(slug)
            rows.append({'key': p['key'], 'name': p['name'], 'img': p.get('img'), 'offs': offs, 'slug': slug,
                         'brand': slug.split('-')[0], 'min': offs[0]['price'], 'max': offs[-1]['price']})
        rows.sort(key=lambda r: (-len(r['offs']), r['name'].lower()))
        models[c['id']] = rows

    tmp = ROOT / 'narx.tmp'
    if tmp.exists(): shutil.rmtree(tmp)
    urls = [(f'{SITE}/', '1.0'), (f'{SITE}/narx/', '0.8')]

    for c in cats:
        rows = models.get(c['id']) or []
        if not rows: continue
        cu, cr = c['uz'], c['ru']
        for r in rows:
            n, mn, mx = len(r['offs']), r['min'], r['max']
            url = f"{SITE}/narx/{c['id']}/{r['slug']}/"
            app = '/?p=' + re.sub(r'[^A-Za-z0-9_.~-]', lambda m: ''.join(f'%{b:02X}' for b in m.group().encode()), r['key'])
            title = f"{r['name']} narxi — {som(mn)} so'mdan, {n} ta do'konda | Narxi"
            desc = (f"{r['name']} narxi Toshkentda va O'zbekistonda: {som(mn)} so'mdan" + (f" {som(mx)} so'mgacha" if n > 1 else '') +
                    f". {n} ta do'kon narxini solishtiring. Цена {r['name']} от {som(mn)} сум.")
            trs = []
            for o in r['offs']:
                old = f"<s>{som(o['old'])}</s>" if o.get('old') and o['old'] > o['price'] else ''
                inst = f"<small>oyiga {som(o['inst'])} × {o['instm']}</small>" if o.get('inst') and o.get('instm') else ''
                sim = f"<span class=simt>{SIML[sim_of(o.get('title'))]}</span>" if r['key'].startswith('phones:iphone') else ''
                ttl = f"<small class=ot>{sim}{e(o.get('title'))}</small>" if o.get('title') else ''
                trs.append(f"<tr><td class=st>{e(STORES.get(o['store'], o['store']))}{ttl}</td><td class=pr>{old}{som(o['price'])} so'm{inst}</td>"
                           f"<td class=lnk><a href=\"{e(o['url'])}\" rel=\"nofollow noopener\" target=\"_blank\">Do'konga →</a></td></tr>")
            sim = [x for x in rows if x is not r and x['brand'] == r['brand']]
            sim.sort(key=lambda x: abs(x['min'] - mn))
            if len(sim) < MAX_SIMILAR:
                sim += sorted([x for x in rows if x is not r and x not in sim], key=lambda x: abs(x['min'] - mn))[:MAX_SIMILAR - len(sim)]
            sim = sim[:MAX_SIMILAR]
            save = f'<span class=save>Farq: {som(mx - mn)} so\'m</span>' if n > 1 and mx > mn else ''
            img = f'<img src="{e(r["img"])}" alt="{e(r["name"])}" loading="lazy" referrerpolicy="no-referrer">' if r.get('img') else ''
            body = (f'<div class=bc><a href="/">Narxi</a> › <a href="/narx/{c["id"]}/">{e(cu)}</a> › {e(r["name"])}</div>'
                    f'<h1>{e(r["name"])} narxi</h1><p class=sub>{n} ta do\'kon · narxlar har 3 soatda yangilanadi</p>'
                    f'<div class="card top">{img}<div class=best>Eng arzon narx — {e(STORES.get(r["offs"][0]["store"], ""))}<b>{som(mn)} so\'m</b>{save}</div></div>'
                    f'<div class=card><h2>Do\'konlardagi narxlar</h2><p class=cn>Narx rang va versiyaga qarab farq qilishi mumkin — biz ularni ajratmaymiz. Kerakli variantni do\'kon saytida tanlang.</p><table>{"".join(trs)}</table></div>'
                    f'<a class=cta href="{app}">Narx tushsa xabar olish — Narxi\'da ochish</a>'
                    f'<p class=ru>Цена {e(r["name"])} в Ташкенте и Узбекистане: от {som(mn)} сум' + (f' до {som(mx)} сум' if n > 1 else '') +
                    f' в {n} магазинах. Сравните цены и купите там, где дешевле.</p>'
                    + (f'<div class=card><h2>O\'xshash modellar</h2><ul class=l>' +
                       ''.join(f'<li><a href="/narx/{c["id"]}/{x["slug"]}/">{e(x["name"])}</a><span>{som(x["min"])} so\'m</span></li>' for x in sim) +
                       '</ul></div>' if sim else ''))
            ld = [{'@context': 'https://schema.org', '@type': 'Product', 'name': r['name'], 'image': [r['img']] if r.get('img') else None, 'url': url,
                   'offers': {'@type': 'AggregateOffer', 'priceCurrency': 'UZS', 'lowPrice': mn, 'highPrice': mx, 'offerCount': n,
                              'offers': [{'@type': 'Offer', 'price': o['price'], 'priceCurrency': 'UZS', 'url': o['url'], 'availability': 'https://schema.org/InStock',
                                          'seller': {'@type': 'Organization', 'name': STORES.get(o['store'], o['store'])}} for o in r['offs']]}},
                  {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
                      {'@type': 'ListItem', 'position': 1, 'name': 'Narxi', 'item': f'{SITE}/'},
                      {'@type': 'ListItem', 'position': 2, 'name': cu, 'item': f"{SITE}/narx/{c['id']}/"},
                      {'@type': 'ListItem', 'position': 3, 'name': r['name'], 'item': url}]}]
            ld[0] = {k: v for k, v in ld[0].items() if v is not None}
            write(tmp / c['id'] / r['slug'] / 'index.html', page(title, desc, url, body, ld))
            urls.append((url, '0.7'))
        # category hub
        lis = ''.join(f'<li><a href="/narx/{c["id"]}/{r["slug"]}/">{e(r["name"])}</a><span>{som(r["min"])} so\'m</span></li>' for r in rows)
        body = (f'<div class=bc><a href="/">Narxi</a> › <a href="/narx/">Katalog</a> › {e(cu)}</div><h1>{e(cu)} narxlari</h1>'
                f'<p class=sub>{len(rows)} ta model · yangilangan {e(upd_txt)}</p><p class=ru>{e(cr)}: цены в интернет-магазинах Узбекистана.</p>'
                f'<div class=card><ul class=l>{lis}</ul></div>')
        write(tmp / c['id'] / 'index.html', page(f"{cu} narxlari O'zbekistonda — {len(rows)} ta model | Narxi",
                                                 f"{cu} narxlarini {len(rows)} ta model bo'yicha solishtiring. {cr} — цены в магазинах Узбекистана.",
                                                 f"{SITE}/narx/{c['id']}/", body))
        urls.append((f"{SITE}/narx/{c['id']}/", '0.8'))

    # catalog hub
    blocks = []
    for c in cats:
        rows = models.get(c['id']) or []
        if not rows: continue
        top = ''.join(f'<li><a href="/narx/{c["id"]}/{r["slug"]}/">{e(r["name"])}</a><span>{som(r["min"])} so\'m</span></li>' for r in rows[:8])
        blocks.append(f'<div class=card><h2><a href="/narx/{c["id"]}/">{e(c["uz"])}</a> <span class=ru>· {len(rows)} ta</span></h2><ul class=l>{top}</ul></div>')
    write(tmp / 'index.html', page("Narxlar katalogi — telefon, noutbuk, texnika narxlari | Narxi",
                                   "O'zbekistondagi onlayn do'konlarda telefon, planshet, televizor va maishiy texnika narxlarini solishtiring.",
                                   f'{SITE}/narx/', '<h1>Narxlar katalogi</h1><p class=sub>Yangilangan ' + e(upd_txt) + '</p>' + ''.join(blocks)))

    write(tmp / 's.css', CSS)
    if OUT.exists(): shutil.rmtree(OUT)
    tmp.rename(OUT)
    sm = ''.join(f'<url><loc>{u}</loc><lastmod>{day}</lastmod><priority>{p}</priority></url>' for u, p in urls)
    (ROOT / 'sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>\n')
    print(f'seo: {len(urls) - 2} urls')

if __name__ == '__main__':
    main()
