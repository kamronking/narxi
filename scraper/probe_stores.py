"""Probe round 2: save full catalog pages for alifshop/glotr/ishonch; try elmakon/goodzone (broken TLS chain)."""
import re, json, os, requests, urllib.robotparser as rp, urllib3
urllib3.disable_warnings()
UA='NarxiBot/0.1 (+https://github.com/kamronking/narxi; price comparison)'
H={'User-Agent':UA,'Accept-Language':'ru-RU,ru;q=0.9'}
os.makedirs('docs/data/probe2',exist_ok=True);out=[]
def save(name,url,verify=True):
    try:
        r=requests.get(url,headers=H,timeout=30,verify=verify);t=r.text
        open(f'docs/data/probe2/{name}.html','w').write(t[:1500000])
        rec={'name':name,'url':url,'status':r.status_code,'len':len(t),'jsonld':t.count('application/ld+json'),'nuxt':'__NUXT' in t,'next':'__NEXT_DATA__' in t,'sum':len(re.findall(r'сум|so.m',t,re.I))}
    except Exception as e: rec={'name':name,'url':url,'error':repr(e)[:200]};t=''
    out.append(rec);print(json.dumps(rec,ensure_ascii=False));return t
save('alif_cat','https://alifshop.uz/ru/categories/smartfoni-i-telefoni')
g=save('glotr_cat','https://glotr.uz/telefoni-i-plansheti/')
sub=[l for l in re.findall(r'href="(https://glotr\.uz/[a-z0-9-]+/)"',g) if 'smartfon' in l][:3]
for i,l in enumerate(sub):save(f'glotr_sub{i}',l)
save('ishonch_sitemap','https://ishonch.uz/sitemap.xml')
for d in ['elmakon.uz','goodzone.uz']:
  try:
      h=save(d.split('.')[0]+'_home',f'https://{d}/',verify=False)
      rb=requests.get(f'https://{d}/robots.txt',headers=H,timeout=20,verify=False).text
      open(f'docs/data/probe2/{d}_robots.txt','w').write(rb[:20000])
      links=[l for l in re.findall(r'href="([^"#]+)"',h) if re.search(r'smartfon|telefon|smartphone',l,re.I)]
      links=[l if l.startswith('http') else f'https://{d}'+('' if l.startswith('/') else '/')+l for l in links]
      if links:save(d.split('.')[0]+'_cat',links[0],verify=False)
  except Exception as e:
    out.append({'name':d,'error':repr(e)[:200]})
json.dump(out,open('docs/data/probe2/summary.json','w'),ensure_ascii=False,indent=1)
