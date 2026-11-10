"""Survey candidate stores: robots, protection, platform, product data availability. Honest UA, no circumvention."""
import json, re, os, sys, ssl, socket, tempfile, requests, certifi, urllib.robotparser as rp
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H, UA
OUT = 'docs/data/probe8'; os.makedirs(OUT, exist_ok=True)
C = ['maxcom.uz', 'woot.uz', 'mionline.uz', 'sitronic.uz', 'karcher.uz', 'alishop.uz', 'tezz.uz', 'kattabozor.uz', 'elmakon.uz',
     'goodzone.uz', 'bemarket.uz', 'idea.uz', 'api.idea.uz', 'avtech.uz', 'sello.uz', 'allgood.uz', 'ubuy.uz', 'gammatech.uz',
     'artelshop.uz', 'shop.artel.uz', 'samsung.com', 'istore.uz', 'texnohome.uz', 'smartup.uz']
def aia_bundle(host):
    """Broken chain fix the way browsers do: fetch the missing intermediate via AIA, then verify normally."""
    try:
        from cryptography import x509
        from cryptography.x509.oid import AuthorityInformationAccessOID, ExtensionOID
        pem = ssl.get_server_certificate((host, 443), timeout=15)
        cert = x509.load_pem_x509_certificate(pem.encode())
        aia = cert.extensions.get_extension_for_oid(ExtensionOID.AUTHORITY_INFORMATION_ACCESS).value
        url = [d.access_location.value for d in aia if d.access_method == AuthorityInformationAccessOID.CA_ISSUERS][0]
        der = requests.get(url, timeout=15).content
        try: inter = x509.load_der_x509_certificate(der)
        except Exception: inter = x509.load_pem_x509_certificate(der)
        from cryptography.hazmat.primitives.serialization import Encoding
        f = tempfile.NamedTemporaryFile('w', delete=False, suffix='.pem')
        f.write(open(certifi.where()).read() + '\n' + inter.public_bytes(Encoding.PEM).decode()); f.close()
        return f.name
    except Exception as e:
        return None
VER = {}
def fetch(url, **kw):
    host = re.match(r'https?://([^/]+)', url).group(1)
    try:
        return requests.get(url, headers=H, timeout=25, verify=VER.get(host, True), **kw)
    except requests.exceptions.SSLError:
        b = aia_bundle(host)
        if b:
            VER[host] = b
            return requests.get(url, headers=H, timeout=25, verify=b, **kw)
        raise
def prot(r):
    t = r.text[:20000].lower(); p = []
    if 'cf-chl' in t or 'challenge-platform' in t or 'just a moment' in t: p.append('cloudflare-challenge')
    if 'ddos-guard' in t: p.append('ddos-guard')
    if 'captcha' in t: p.append('captcha')
    if r.status_code in (401, 403, 429, 498, 503): p.append(f'http{r.status_code}')
    return p
res = {}
for d in C:
    base = 'https://' + (d if d != 'samsung.com' else 'www.samsung.com')
    rec = {}
    try:
        r = fetch(base + '/robots.txt'); rec['robots_status'] = r.status_code; rt = r.text if r.status_code == 200 and 'html' not in r.headers.get('content-type', '') else ''
        rec['robots'] = rt[:1500]; rec['tls_fixed'] = bool(VER.get(re.match(r'https://([^/]+)', base).group(1)))
        P = rp.RobotFileParser(); P.parse(rt.splitlines())
        home = base + ('/uz/' if d == 'samsung.com' else '/')
        rec['allow_home'] = P.can_fetch(UA, home)
        h = fetch(home); t = h.text
        rec.update(home_status=h.status_code, final=h.url, server=h.headers.get('server'), prot=prot(h), len=len(t),
                   title=(re.search(r'<title[^>]*>([^<]{0,120})', t, re.I) or [None, None])[1],
                   platform=[k for k, w in {'shopify': 'cdn.shopify', 'bitrix': 'bitrix', 'woocommerce': 'woocommerce', 'nuxt': '__NUXT', 'next': '__NEXT_DATA__', 'opencart': 'route=product', 'tilda': 'tilda', 'insales': 'insales'}.items() if w.lower() in t.lower()],
                   jsonld=t.count('application/ld+json'), sum=len(re.findall(r'сум|so.m|uzs', t, re.I)))
        sm = re.findall(r'(?im)^sitemap:\s*(\S+)', rt) or [base + '/sitemap.xml']
        try:
            s = fetch(sm[0]); rec['sitemap'] = {'url': sm[0], 'status': s.status_code, 'locs': s.text.count('<loc>'), 'sample': re.findall(r'<loc>([^<]+)', s.text)[:6]}
        except Exception as e: rec['sitemap'] = repr(e)[:150]
        if 'shopify' in rec['platform']:
            try: s = fetch(base + '/products.json?limit=2'); rec['shopify_json'] = s.status_code
            except Exception as e: rec['shopify_json'] = repr(e)[:100]
        if 'woocommerce' in rec['platform']:
            try: s = fetch(base + '/wp-json/wc/store/v1/products?per_page=2'); rec['wc_api'] = [s.status_code, s.text[:300]]
            except Exception as e: rec['wc_api'] = repr(e)[:100]
        open(f'{OUT}/{d}.html', 'w').write(t[:800000])
    except Exception as e:
        rec['error'] = repr(e)[:220]
    res[d] = rec; print(d, json.dumps(rec, ensure_ascii=False)[:300])
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
