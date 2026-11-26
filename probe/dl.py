import json,hashlib,os,requests
urls=json.load(open('probe/urls.json'));os.makedirs('probe/img',exist_ok=True);idx={}
H={'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}
for u in urls:
  try:
    r=requests.get(u,headers=H,timeout=25)
    if r.ok and len(r.content)>500:
      ext={'image/png':'.png','image/webp':'.webp','image/avif':'.avif'}.get(r.headers.get('content-type','').split(';')[0],'.jpg')
      n=hashlib.md5(u.encode()).hexdigest()[:16]+ext;open('probe/img/'+n,'wb').write(r.content);idx[u]=n
    print(r.status_code,len(r.content),u[:80])
  except Exception as e: print('ERR',e,u[:80])
json.dump(idx,open('probe/img/index.json','w'))
