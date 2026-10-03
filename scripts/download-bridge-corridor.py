import json,math,subprocess,concurrent.futures,mapbox_vector_tile,pathlib
z=10;n=2**z;routes=json.load(open('routes-live.json'));tiles=set()
def tile(p):return int((p[1]+180)/360*n),int((1-math.asinh(math.tan(math.radians(p[0])))/math.pi)/2*n)
for k in ['sanyo','chugoku','hiroshima','hiroshima_iwakuni']:
 for seg in routes[k]['segs']:
  for p in seg:
   x,y=tile(p);tiles.add((x,y))
cache=pathlib.Path('bridge-tiles');cache.mkdir(exist_ok=True)
def get(t):
 x,y=t;file=cache/f'{z}-{x}-{y}.pbf'
 if not file.exists():
  subprocess.run(['curl','-L','--fail','--max-time','40','-s','-o',str(file),f'https://mapdata.qchizu.jp/m56001/release-20260922-154454/2024/bridge_tile_detail/{z}/{x}/{y}.pbf'],check=True)
 out=[]
 for l in mapbox_vector_tile.decode(file.read_bytes()).values():
  ext=l['extent']
  for f in l['features']:
   px,py=f['geometry']['coordinates'];lon=(x+px/ext)/n*360-180;lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+1-py/ext)/n))))
   if f['properties'].get('施設名'):out.append({'point':[lat,lon],'properties':f['properties']})
 return out
print('tiles',len(tiles),flush=True)
rows=[];failures=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 futures={pool.submit(get,t):t for t in sorted(tiles)}
 for f in concurrent.futures.as_completed(futures):
  try:rows.extend(f.result())
  except Exception as e:failures.append(str(e))
json.dump({'rows':rows,'failures':failures,'tiles':len(tiles)},open('bridge-corridor.json','w'),ensure_ascii=False)
print('rows',len(rows),'failures',len(failures),flush=True)
