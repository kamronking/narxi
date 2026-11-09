"""One-off probe: fetch store pages and save raw responses so we can learn each site's structure."""
import os, re, json, requests, urllib.parse as up
UA={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36','Accept-Language':'ru-RU,ru;q=0.9,uz;q=0.8'}
Q='iphone 16'
URLS={
 'uzum':['https://uzum.uz/robots.txt',f'https://uzum.uz/ru/search?query={up.quote(Q)}','https://api.uzum.uz/api/main/search/suggestions?text=iphone'],
 'texnomart':['https://texnomart.uz/robots.txt',f'https://texnomart.uz/ru/search?q={up.quote(Q)}',f'https://texnomart.uz/search?q={up.quote(Q)}'],
 'mediapark':['https://mediapark.uz/robots.txt',f'https://mediapark.uz/search?q={up.quote(Q)}',f'https://mediapark.uz/ru/search?q={up.quote(Q)}'],
 'olcha':['https://olcha.uz/robots.txt',f'https://olcha.uz/ru/search?q={up.quote(Q)}',f'https://mobile.olcha.uz/api/v2/products?search={up.quote(Q)}'],
 'asaxiy':['https://asaxiy.uz/robots.txt',f'https://asaxiy.uz/ru/product?key={up.quote(Q)}'],
 'idea':['https://idea.uz/robots.txt',f'https://idea.uz/search?q={up.quote(Q)}',f'https://idea.uz/ru/search?q={up.quote(Q)}'],
}
os.makedirs('probe_out',exist_ok=True)
summary=[]
for store,urls in URLS.items():
    for i,u in enumerate(urls):
        try:
            r=requests.get(u,headers=UA,timeout=25,allow_redirects=True)
            body=r.text
            info={'store':store,'url':u,'final':r.url,'status':r.status_code,'ctype':r.headers.get('content-type'),'len':len(body),
                  'has_next_data':'__NEXT_DATA__' in body,'has_nuxt':'__NUXT__' in body,'jsonld':len(re.findall(r'application/ld\+json',body)),
                  'price_hits':len(re.findall(r'(?:price|цена|narx)',body,re.I))}
            open(f'probe_out/{store}_{i}.txt','w').write(json.dumps(info,ensure_ascii=False)+'\n\n'+body[:400000])
        except Exception as e:
            info={'store':store,'url':u,'error':repr(e)}
        summary.append(info);print(info)
        # follow sitemap hints from robots
        if u.endswith('robots.txt') and 'status' in info and info['status']==200:
            sm=re.findall(r'(?im)^sitemap:\s*(\S+)',body)[:2]
            for j,s in enumerate(sm):
                try:
                    r2=requests.get(s,headers=UA,timeout=25);open(f'probe_out/{store}_sitemap{j}.txt','w').write(s+'\n'+str(r2.status_code)+'\n\n'+r2.text[:200000])
                    summary.append({'store':store,'sitemap':s,'status':r2.status_code,'len':len(r2.text)})
                except Exception as e: summary.append({'store':store,'sitemap':s,'error':repr(e)})
json.dump(summary,open('probe_out/summary.json','w'),ensure_ascii=False,indent=1)
