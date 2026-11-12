"""Deeper look at openshop.uz, elmakon.uz, goodzone.uz (public pages, honest UA).
elmakon/goodzone serve an incomplete TLS chain: fetch the missing intermediate via the cert's AIA URL and verify normally with it."""
import json, re, os, sys, ssl, socket, requests, certifi, tempfile
from cryptography import x509
from cryptography.x509.oid import ExtensionOID, AuthorityInformationAccessOID
from cryptography.hazmat.primitives.serialization import Encoding
sys.path.insert(0, os.path.dirname(__file__))
from scrape import H
OUT = 'docs/data/probe13'; os.makedirs(OUT, exist_ok=True); res = {}

def bundle_for(host):
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE  # only to READ the server's leaf cert
    with socket.create_connection((host, 443), timeout=20) as s, ctx.wrap_socket(s, server_hostname=host) as ss:
        leaf = x509.load_der_x509_certificate(ss.getpeercert(True))
    pems = []
    cur = leaf
    for _ in range(3):
        try:
            aia = cur.extensions.get_extension_for_oid(ExtensionOID.AUTHORITY_INFORMATION_ACCESS).value
        except Exception:
            break
        url = next((d.access_location.value for d in aia if d.access_method == AuthorityInformationAccessOID.CA_ISSUERS), None)
        if not url: break
        raw = requests.get(url, timeout=20).content
        try: cur = x509.load_der_x509_certificate(raw)
        except Exception: cur = x509.load_pem_x509_certificate(raw)
        pems.append(cur.public_bytes(Encoding.PEM).decode())
        if cur.issuer == cur.subject: break
    f = tempfile.NamedTemporaryFile('w', suffix='.pem', delete=False)
    f.write(open(certifi.where()).read() + '\n' + '\n'.join(pems)); f.close()
    return f.name, [c.split('\n')[1][:20] for c in pems]

def look(host, verify=True):
    o = {}
    r = requests.get(f'https://{host}/robots.txt', headers=H, timeout=25, verify=verify)
    o['robots_st'] = r.status_code; o['robots'] = r.text[:2500]
    o['sitemaps'] = re.findall(r'(?im)^\s*sitemap:\s*(\S+)', r.text)[:5]
    sm = o['sitemaps'][0] if o['sitemaps'] else f'https://{host}/sitemap.xml'
    s = requests.get(sm, headers=H, timeout=25, verify=verify); o['sm_st'] = s.status_code; o['sm_head'] = s.text[:800]
    subs = re.findall(r'<loc>([^<]+)</loc>', s.text)
    prod_urls = []
    for u in subs[:12]:
        if u.endswith('.xml') or 'sitemap' in u:
            try:
                ss = requests.get(u, headers=H, timeout=25, verify=verify)
                locs = re.findall(r'<loc>([^<]+)</loc>', ss.text)
                o.setdefault('sub', {})[u] = {'n': len(locs), 'ex': locs[:3]}
                prod_urls += [l for l in locs if re.search(r'/(product|tovar|p|item|catalog)/', l)]
            except Exception as e:
                o.setdefault('sub', {})[u] = {'err': repr(e)[:100]}
        elif re.search(r'/(product|tovar|p|item)/', u):
            prod_urls.append(u)
    o['prod_example'] = prod_urls[:3]
    if prod_urls:
        p = requests.get(prod_urls[0], headers=H, timeout=25, verify=verify); t = p.text
        o['p_st'] = p.status_code; o['p_len'] = len(t)
        o['ld'] = [x[:700] for x in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', t, re.S)][:2]
        o['og'] = re.findall(r'<meta[^>]+property="(?:og|product):[^"]+"[^>]*>', t)[:8]
        o['price_snips'] = [t[max(0, m.start() - 120):m.end() + 40] for m in re.finditer(r'\d[\d\s ]{4,}\s*(?:сум|so[\'ʻ`]?m|UZS)', t, re.I)][:3]
        o['next'] = '__NEXT_DATA__' in t; o['nuxt'] = '__NUXT__' in t
    return o

for host in ['openshop.uz', 'elmakon.uz', 'goodzone.uz']:
    try:
        v = True
        if host != 'openshop.uz':
            v, info = bundle_for(host); res.setdefault(host, {})['chain_added'] = info
        res.setdefault(host, {}).update(look(host, v))
    except Exception as e:
        res.setdefault(host, {})['err'] = repr(e)[:300]
json.dump(res, open(f'{OUT}/summary.json', 'w'), ensure_ascii=False, indent=1)
for k, v in res.items():
    print(k, {x: v.get(x) for x in ('chain_added', 'robots_st', 'sm_st', 'prod_example', 'p_st', 'next', 'nuxt', 'err')})
