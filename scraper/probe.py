"""Probe round 3: only robots-allowed pages, honest bot identity."""
import os, re, json, requests
UA={'User-Agent':'NarxiBot/0.1 (+https://github.com/kamronking/narxi; price comparison)','Accept-Language':'ru-RU,ru;q=0.9'}
os.makedirs('probe_out3',exist_ok=True);S=[]
def get(name,u,keep=400000):
    try:
        r=requests.get(u,headers=UA,timeout=25)
        info={'name':name,'url':u,'final':r.url,'status':r.status_code,'len':len(r.text),'jsonld':r.text.count('application/ld+json'),'cards':r.text.count('product-card__actual-price'),'detail_links':len(set(re.findall(r'/product/detail/\d+',r.text))),'sum':r.text.count('сум')}
        open(f'probe_out3/{name}.txt','w').write(json.dumps(info,ensure_ascii=False)+'\n\n'+r.text[:keep]);S.append(info);print(info);return r
    except Exception as e:
        S.append({'name':name,'url':u,'error':repr(e)});print(name,e)
get('olcha_mobile_robots','https://mobile.olcha.uz/robots.txt',keep=5000)
r=get('uzum_sm_categories','https://uzum.uz/ru/sitemaps/categories.xml',keep=200000)
cats=re.findall(r'<loc>([^<]+)</loc>',r.text) if r is not None else []
sm=[c for c in cats if re.search(r'smartfon',c,re.I)][:3]
for i,c in enumerate(sm):get(f'uzum_cat{i}',c)
r=get('tm_katalog','https://texnomart.uz/ru/katalog/smartfony')
if r is not None:
    ids=sorted(set(re.findall(r'/ru/product/detail/(\d+)',r.text)))[:2]
    for i,d in enumerate(ids):get(f'tm_detail{i}',f'https://texnomart.uz/ru/product/detail/{d}/')
get('tm_katalog_apple','https://texnomart.uz/ru/katalog/smartfony-apple')
json.dump(S,open('probe_out3/summary.json','w'),ensure_ascii=False,indent=1)
