"""Probe round 2: find search endpoints and product page structure."""
import os, re, json, requests, urllib.parse as up
B={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36','Accept-Language':'ru-RU,ru;q=0.9','Accept':'text/html,application/json;q=0.9,*/*;q=0.8'}
GB={'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'}
os.makedirs('probe_out2',exist_ok=True);S=[]
def get(name,u,h=B,keep=300000):
    try:
        r=requests.get(u,headers=h,timeout=25)
        info={'name':name,'url':u,'status':r.status_code,'ctype':r.headers.get('content-type'),'len':len(r.text),'jsonld':r.text.count('application/ld+json'),'next':'__NEXT_DATA__' in r.text}
        open(f'probe_out2/{name}.txt','w').write(json.dumps(info,ensure_ascii=False)+'\n\n'+r.text[:keep]);S.append(info);print(info);return r
    except Exception as e:
        S.append({'name':name,'url':u,'error':repr(e)});print(name,e)
Q='iphone 16'
for k in ['q','query','keyword','search_text','name','text','s']:
    get(f'olcha_{k}',f'https://mobile.olcha.uz/api/v2/products?{k}={up.quote(Q)}',keep=4000)
for u in ['https://mobile.olcha.uz/api/v2/search?q=iphone%2016','https://mobile.olcha.uz/api/v2/search/products?q=iphone%2016','https://mobile.olcha.uz/api/v1/search?q=iphone%2016','https://mobile.olcha.uz/api/v2/products/search?q=iphone%2016']:
    get('olcha_'+re.sub(r'\W+','_',u[27:60]),u,keep=6000)
sm=get('uzum_sm_products','https://uzum.uz/ru/sitemaps/products_in_stock.xml',keep=60000)
locs=re.findall(r'<loc>([^<]+)</loc>',sm.text) if sm is not None else []
for i,l in enumerate(locs[:3]):
    r=get(f'uzum_sub{i}',l,keep=20000)
    if r is not None:
        pl=re.findall(r'<loc>([^<]+)</loc>',r.text)[:2]
        for j,p in enumerate(pl):
            get(f'uzum_page{i}_{j}_bot',p,h=GB)
            m=re.search(r'-(\d+)(?:\?|$)',p)
            if m:get(f'uzum_api{i}_{j}',f'https://api.uzum.uz/api/v2/product/{m.group(1)}',keep=60000)
        break
get('uzum_search_bot',f'https://uzum.uz/ru/search?query={up.quote(Q)}',h=GB)
r=get('tm_sm_products','https://texnomart.uz/sitemap-ru-products-1.xml',keep=60000)
if r is not None:
    allp=re.findall(r'<loc>([^<]+)</loc>',r.text)
    pl=[l for l in allp if 'iphone' in l.lower()][:2] or allp[:2]
    for j,p in enumerate(pl):get(f'tm_page{j}',p)
for u in ['https://gateway.texnomart.uz/api/web/v1/search/full?q=iphone%2016','https://gateway.texnomart.uz/api/common/v1/search/result?q=iphone%2016','https://texnomart.uz/ru/search?search=iphone%2016','https://texnomart.uz/ru/katalog/search?q=iphone%2016']:
    get('tm_'+re.sub(r'\W+','_',u[8:70]),u,keep=20000)
r=get('idea_search','https://idea.uz/search?q=iphone%2016',keep=200000)
paths=set()
if r is not None:
    for c in re.findall(r'/_next/static/chunks/[^"]+\.js',r.text)[:40]:
        try:
            js=requests.get('https://idea.uz'+c,headers=B,timeout=20).text
            for m in re.findall(r'["\'`](/(?:api|v1|v2|public)[^"\'`\s]{2,80})["\'`]',js):paths.add(m)
            for m in re.findall(r'["\'`](https?://[a-z0-9.-]*inweb[^"\'`\s]{0,80})["\'`]',js):paths.add(m)
        except Exception:pass
open('probe_out2/idea_paths.txt','w').write('\n'.join(sorted(paths)))
for u in ['https://api.idea.inweb.uz/api/v2/products/search?q=iphone%2016','https://api.idea.inweb.uz/api/v1/search?q=iphone%2016','https://api.idea.inweb.uz/api/v2/search?q=iphone%2016']:
    get('idea_'+re.sub(r'\W+','_',u[25:70]),u,keep=20000)
get('mp_bot','https://mediapark.uz/',h=GB,keep=20000);get('asx_bot','https://asaxiy.uz/',h=GB,keep=20000)
json.dump(S,open('probe_out2/summary.json','w'),ensure_ascii=False,indent=1)
