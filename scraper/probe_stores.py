"""Probe more Uzbek stores: robots rules, whether catalog pages are reachable and carry prices."""
import re, json, os, requests, urllib.robotparser as rp
UA='NarxiBot/0.1 (+https://github.com/kamronking/narxi; price comparison)'
H={'User-Agent':UA,'Accept-Language':'ru-RU,ru;q=0.9'}
DOMS=['mediapark.uz','asaxiy.uz','idea.uz','elmakon.uz','goodzone.uz','alifshop.uz','sello.uz','zoodmall.uz','glotr.uz','ishonch.uz','artelstore.uz','uzum.uz','bemarket.uz','smartupshop.uz','texnomart.uz']
os.makedirs('docs/data/probe',exist_ok=True);out=[]
for d in DOMS:
    rec={'domain':d}
    try:
        r=requests.get(f'https://{d}/robots.txt',headers=H,timeout=20);rec['robots']=r.status_code
        robots=rp.RobotFileParser();robots.parse(r.text.splitlines() if r.status_code==200 else [])
        rec['sitemaps']=re.findall(r'(?im)^sitemap:\s*(\S+)',r.text)[:3] if r.status_code==200 else []
        h=requests.get(f'https://{d}/',headers=H,timeout=20);rec['home']=h.status_code;rec['home_len']=len(h.text)
        links=[l for l in re.findall(r'href="([^"#]+)"',h.text) if re.search(r'smartfon|telefon|smartphone|mobiln',l,re.I)]
        links=[l if l.startswith('http') else f'https://{d}'+('' if l.startswith('/') else '/')+l for l in links]
        rec['cat_links']=list(dict.fromkeys(links))[:5]
        if rec['cat_links']:
            u=rec['cat_links'][0];rec['cat_allowed']=robots.can_fetch(UA,u)
            if rec['cat_allowed']:
                c=requests.get(u,headers=H,timeout=25);t=c.text
                rec.update({'cat_url':u,'cat_status':c.status_code,'cat_len':len(t),'jsonld':t.count('application/ld+json'),'itemlist':'ItemList' in t,
                    'offers_price':len(re.findall(r'"price"\s*:\s*"?\d',t)),'next':'__NEXT_DATA__' in t,'nuxt':'__NUXT' in t,'sum':len(re.findall(r'сум|so.m|UZS',t,re.I))})
                open(f'docs/data/probe/{d}.html','w').write(t[:250000])
    except Exception as e:
        rec['error']=repr(e)[:200]
    out.append(rec);print(json.dumps(rec,ensure_ascii=False))
json.dump(out,open('docs/data/probe/summary.json','w'),ensure_ascii=False,indent=1)
