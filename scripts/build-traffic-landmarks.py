"""Build hidden traffic anchors from Geofabrik OSM extract and MLIT/Q tiles.
Inputs are downloaded snapshots; this is deliberately not a runtime API query.
python scripts/build-traffic-landmarks.py osm-landmarks-fast.json tunnel-points.json routes-live.json
"""
import json,sys,re,math,collections
from shapely.geometry import LineString,MultiLineString,Point
osm,mlit,routes=[json.load(open(p))for p in sys.argv[1:4]]
cos=.824
xy=lambda p:(p[1]*cos,p[0])
ll=lambda p:[round(p.y,7),round(p.x/cos,7)]
lines={k:MultiLineString([[xy(p)for p in s]for s in r['segs'] if len(s)>1])for k,r in routes.items()}
roadnames={'山陽自動車道':'sanyo','中国自動車道':'chugoku','中国縦貫自動車道':'chugoku','米子自動車道':'yonago','岡山自動車道':'okayama','浜田自動車道':'hamada','松江自動車道':'matsue','広島自動車道':'hiroshima','山陰自動車道':'sanin','広島呉道路':'hiroshima_kure','広島岩国道路':'hiroshima_iwakuni','瀬戸中央自動車道':'seto','西瀬戸自動車道':'shimanami','尾道自動車道':'onomichi','東広島呉自動車道':'higashihiroshima_kure','鳥取自動車道':'tottori','小郡道路':'ogori','松永道路':'matsunaga','関門トンネル':'kanmon_tunnel','関門橋':'kanmon_bridge'}
refkeys={'E2':['sanyo','hiroshima_iwakuni','matsunaga'],'E2A':['chugoku'],'E73':['okayama','yonago'],'E74':['hiroshima','hamada'],'E54':['onomichi','matsue'],'E9':['sanin'],'E29':['tottori'],'E30':['seto'],'E31':['hiroshima_kure'],'E76':['shimanami'],'E75':['higashihiroshima_kure']}
def assign(tags,p,official=False):
 name=tags.get('路線名','')if official else tags.get('name','')
 candidates=[k for n,k in roadnames.items()if n in name]
 if official:
  if '岡山米子線'in name:candidates=['okayama','yonago']
  if '尾道松江線'in name:candidates=['onomichi','matsue','sanin']
  if '広島浜田線'in name:candidates=['hiroshima','hamada']
  if '姫路鳥取線'in name:candidates=['tottori']
  if '山陽自動車道'in name:candidates=['sanyo']
  if '山陰自動車道'in name:candidates=['sanin']
 if not candidates:
  for ref in re.split('[; ]',tags.get('ref','')):candidates.extend(refkeys.get(ref,[]))
 if not candidates:return None
 key=min(candidates,key=lambda k:lines[k].distance(Point(xy(p))))
 return key if lines[key].distance(Point(xy(p)))*111< (8 if official else 5)else None
def kp(key,p):
 marks=routes[key]['marks'];i=min(range(len(marks)),key=lambda i:(marks[i][1]-p[0])**2+((marks[i][2]-p[1])*cos)**2)
 candidates=[]
 for j in range(max(0,i-1),min(len(marks)-1,i+1)):
  a,b=marks[j],marks[j+1];line=LineString([xy(a[1:]),xy(b[1:])]);point=Point(xy(p));t=line.project(point,normalized=True)
  candidates.append((line.distance(point),a[0]+(b[0]-a[0])*t))
 return min(candidates)[1] if candidates else marks[i][0]
# Connected OSM tunnel fragments have shared node IDs. Keep each carriageway separate.
ways=[w for w in osm['ways']if w['tags'].get('tunnel')not in (None,'no') and w['tags'].get('highway')in ('motorway','trunk')]
start=collections.defaultdict(list)
for i,w in enumerate(ways):start[w['nodes'][0]].append(i)
used=set();chains=[]
for i,w in enumerate(ways):
 if i in used:continue
 ids=[i];used.add(i);path=w['geometry'][:];nodes=w['nodes'][:]
 while True:
  choices=[j for j in start[nodes[-1]]if j not in used and ways[j]['tags'].get('ref')==w['tags'].get('ref')]
  if len(choices)!=1:break
  j=choices[0];used.add(j);ids.append(j);path.extend(ways[j]['geometry'][1:]);nodes.extend(ways[j]['nodes'][1:])
 chains.append({'ways':[ways[j]['id']for j in ids],'tags':w['tags'],'geometry':path,'line':LineString([xy(p)for p in path])})
# Chains can appear in backwards file order: merge again until no directed connection remains.
changed=True
while changed:
 changed=False
 for a in chains:
  if a.get('removed'):continue
  for b in chains:
   if a is b or b.get('removed')or a['tags'].get('ref')!=b['tags'].get('ref'):continue
   if a['geometry'][-1]==b['geometry'][0]:
    a['geometry'].extend(b['geometry'][1:]);a['ways'].extend(b['ways']);a['line']=LineString([xy(p)for p in a['geometry']]);b['removed']=True;changed=True
chains=[c for c in chains if not c.get('removed')]
for c in chains:c['key']=assign(c['tags'],ll(c['line'].interpolate(.5,normalized=True)))
entries=collections.defaultdict(list);claimed={}
def add(name,key,c,source):
 if not name or not key:return
 point=ll(c['line'].interpolate(.5,normalized=True));path=c['geometry'];direction='down'if kp(key,path[-1])>kp(key,path[0])else'up'
 if key=='hiroshima':direction='up'if direction=='down'else'down'
 if c['tags'].get('oneway')=='-1':path=path[::-1];direction='up'if direction=='down'else'down'
 variants=[{'direction':direction,'entry':path[0],'exit':path[-1],'path':path,'osmWays':c['ways']}]
 if c['tags'].get('oneway')not in ('yes','1','-1'):variants.append({'direction':'up'if direction=='down'else'down','entry':path[-1],'exit':path[0],'path':path[::-1],'osmWays':c['ways']})
 existing=next((e for e in entries[key]if e['name']==name and math.dist(xy(e['point']),xy(point))*111<2),None)
 if existing:
  known={tuple(v['osmWays'])for v in existing['variants']}
  existing['variants'].extend(v for v in variants if tuple(v['osmWays'])not in known)
 else:entries[key].append({'name':name,'type':'tunnel','point':point,'variants':variants,'source':source})
 claimed[id(c)]=name
# Name identification uses public structure points, not their quantized position for display.
seen=set();unmatched=[]
for row in mlit:
 p=row['properties'];name=p.get('施設名','');point=row['point'];key=assign(p,point,True)
 signature=(name,tuple(point),p.get('路線名'))
 if signature in seen or not key:continue
 seen.add(signature)
 choices=[(c['line'].distance(Point(xy(point)))*111,c)for c in chains if c['key']==key]
 choices.sort(key=lambda t:t[0]);nearest=choices[0]if choices else None
 if nearest and nearest[0]<.22:
  c=nearest[1];known=claimed.get(id(c))
  if known and known!=name:unmatched.append((key,name,'name-conflict'));continue
  add(name,key,c,'OpenStreetMap geometry; MLIT/Q地図 facility name')
 else:unmatched.append((key,name,'geometry-unmatched'))
for c in chains:
 name=c['tags'].get('tunnel:name:ja')or c['tags'].get('tunnel:name')
 if not name and ('トンネル'in c['tags'].get('name','')):name=c['tags']['name']
 if not claimed.get(id(c)) and name:add(name,c['key'],c,'OpenStreetMap')
# Recover the adjacent carriageway when a quantized structure point identified only one bore.
for key, group in list(entries.items()):
 for e in list(group):
  if e['type']!='tunnel':continue
  knownways={wid for v in e['variants']for wid in v['osmWays']}
  lengths=[sum(math.dist(xy(a),xy(b))*111 for a,b in zip(v['path'],v['path'][1:]))for v in e['variants']]
  for c in chains:
   if c['key']!=key or any(w in knownways for w in c['ways'])or claimed.get(id(c)):continue
   centre=ll(c['line'].interpolate(.5,normalized=True));length=c['line'].length*111
   if math.dist(xy(e['point']),xy(centre))*111<.25 and any(.7<L/length<1.4 for L in lengths):
    add(e['name'],key,c,'OpenStreetMap adjacent carriageway; MLIT/Q地図 facility name')
# Named bridge geometry (not ordinary road names).
for w in osm['ways']:
 if w['tags'].get('bridge')in (None,'no'):continue
 t=w['tags'];name=t.get('bridge:name:ja')or t.get('bridge:name')
 if not name and re.search('大橋|高架橋|橋$',t.get('name','')):name=t['name']
 if not name:continue
 line=LineString([xy(p)for p in w['geometry']]);point=ll(line.interpolate(.5,normalized=True));key=assign(t,point)
 if key and not any(e['name']==name for e in entries[key]):entries[key].append({'name':name,'type':'bridge','point':point,'source':'OpenStreetMap','osmWays':[w['id']]})
# Junctions and highway bus stops are hidden anchors, not additional visible labels.
for node in osm['points']:
 t=node['tags'];name=t.get('name:ja')or t.get('name','');typ=t.get('highway');point=node['point']
 if typ not in ('bus_stop','motorway_junction','services','rest_area')or not name:continue
 if typ=='bus_stop' and not node.get('onHighwayWay') and name not in ('熊谷',):continue
 key=min(lines,key=lambda k:lines[k].distance(Point(xy(point))));dist=lines[key].distance(Point(xy(point)))*111
 if dist>(.15 if typ=='bus_stop'else .6):continue
 if typ=='bus_stop':name=re.sub(r'[（(].*?[）)]','',name).strip();name=name.replace('バス停','')+'バス停'
 elif typ=='motorway_junction'and not re.search('IC|JCT|インターチェンジ|ジャンクション',name):continue
 if any(e['name']==name and math.dist(xy(e['point']),xy(point))*111<1 for e in entries[key]):continue
 entries[key].append({'name':name,'type':typ,'point':point,'source':'OpenStreetMap','osmNodes':[node['id']]})
# Facility registry in the existing app covers endpoints absent from the OSM names.
for key,r in routes.items():
 for f in r.get('facilities',[]):
  if not any(e['name']==f['name']for e in entries[key]):entries[key].append({'name':f['name'],'type':f['type'],'point':[f['lat'],f['lng']],'source':'HighwayOrderedDS'})
# 女夫岩TN is on the Sanin corridor in iHighway although administratively part of the Matsue route.
for e in entries['matsue']:
 if e['name']=='女夫岩トンネル'and not any(x['name']==e['name']for x in entries['sanin']):entries['sanin'].append(e)
for key in entries:entries[key].sort(key=lambda e:(e['type'],e['name']))
result={'version':1,'generatedAt':'2026-10-03','sources':[{'name':'OpenStreetMap contributors / Geofabrik Chugoku','snapshot':'2026-10-01','url':'https://download.geofabrik.de/asia/japan/chugoku.html','license':'ODbL-1.0'},{'name':'MLIT infrastructure inspection names via Q地図 2024','url':'https://qchizu.jp/road-structures/','note':'Facility names used to identify OSM geometry. Noncommercial reference.'},{'name':'HighwayOrderedDS','url':'https://github.com/yH3PO4/HighwayOrderedDS'}],'routes':dict(entries)}
json.dump(result,open('traffic-landmarks.json','w'),ensure_ascii=False,separators=(',',':'))
print('Entries',sum(map(len,entries.values())),'tunnels',sum(e['type']=='tunnel'for v in entries.values()for e in v),'unmatched',len(unmatched))
for key,name,why in unmatched:
 if any(s in name for s in ['米満','塩納','龍王山','大佐','大仁子','吉浦','呉','小屋浦','天応','女夫岩','二川','有漢']):print('UNMATCHED',key,name,why)
for k,v in entries.items():
 for e in v:
  if any(s in e['name']for s in ['米満','塩納','龍王山','大仁子','女夫岩']):print(k,e['name'],e['point'],[(x['direction'],x['entry'],x['exit'])for x in e.get('variants',[])])
