import math,json,urllib.request,concurrent.futures,subprocess
import mapbox_vector_tile
z=7;n=2**z
xs=range(int((130+180)/360*n),int((135+180)/360*n)+1)
def ty(lat):return int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
ys=range(ty(36.5),ty(33)+1)
def get(tile):
 x,y=tile;url=f'https://mapdata.qchizu.jp/m56001/release-20260922-154454/2024/tunnel_tile/{z}/{x}/{y}.pbf'
 try:
  data=subprocess.check_output(['curl','-L','--fail','--max-time','30','-s',url]);d=mapbox_vector_tile.decode(data);out=[]
  for layer in d.values():
   ext=layer['extent']
   for f in layer['features']:
    px,py=f['geometry']['coordinates'];lon=(x+px/ext)/n*360-180;lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+1-py/ext)/n))))
    if 130<=lon<=135 and 33<=lat<=36.5:out.append({'point':[lat,lon],'properties':f['properties']})
  return out
 except Exception as e:print(tile,str(e));return []
rows=sum(list(concurrent.futures.ThreadPoolExecutor(max_workers=4).map(get,[(x,y)for x in xs for y in ys])),[])
json.dump(rows,open('tunnel-points.json','w'),ensure_ascii=False)
print('points',len(rows))
for row in rows:
 if any(s in str(row['properties'])for s in ['米満','塩納','龍王山','大佐','大仁子','吉浦','小屋浦','天応','女夫岩','二川','有漢']):print(row)
