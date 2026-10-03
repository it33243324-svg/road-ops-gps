import json,re,math,collections
from shapely.geometry import LineString,Point
from shapely.strtree import STRtree
keys=['sanyo','chugoku','hiroshima','hiroshima_iwakuni']; names={'山陽自動車道':'sanyo','中国自動車道':'chugoku','中国縦貫自動車道':'chugoku','広島自動車道':'hiroshima','広島岩国道路':'hiroshima_iwakuni'}
xy=lambda p:(p[1]*.824,p[0]); ll=lambda p:[round(p.y,7),round(p.x/.824,7)]
old=json.load(open('baseline-landmarks.json'));osm=json.load(open('osm-landmarks-fast.json'));routes=json.load(open('routes-live.json'));official=json.load(open('bridge-corridor.json'))
ways=[w for w in osm['ways'] if w['tags'].get('bridge') not in [None,'no'] and w['tags'].get('highway') in ['motorway','trunk']]; lines=[LineString([xy(p) for p in w['geometry']]) for w in ways];tree=STRtree(lines)
roadlines={k:[LineString([xy(p) for p in seg]) for seg in routes[k]['segs']] for k in keys}; added=[];unmatched=[];seen=set()
def clean(s):return s.split(';')[-1].replace('（上り）','').replace('（下り）','').replace('(上り)','').replace('(下り)','').strip()
for row in official['rows']:
 prop=row['properties'];road=prop.get('路線名','');name=prop.get('施設名',''); key=next((k for n,k in names.items() if n in road),None)
 if not key or not name or prop.get('管理者名')!='NEXCO西日本' or not clean(name).endswith('橋'):continue
 signature=(key,name,tuple(row['point']))
 if signature in seen:continue
 seen.add(signature);p=Point(xy(row['point']));i=int(tree.nearest(p));line=lines[i];way=ways[i];dist=line.distance(p)*111000
 if dist>35 or min(l.distance(line.interpolate(.5,normalized=True)) for l in roadlines[key])*111000>60:
  unmatched.append({'road':key,'name':name,'distanceM':round(dist),'reason':'no confident motorway bridge match'});continue
 known=way['tags'].get('bridge:name:ja') or way['tags'].get('bridge:name')
 if known and clean(known)!=clean(name):
  unmatched.append({'road':key,'name':name,'reason':'OSM name differs','osmName':known});continue
 point=ll(line.interpolate(.5,normalized=True));existing=next((e for e in old['routes'][key] if e['type']=='bridge' and clean(e['name'])==clean(name) and math.dist(xy(e['point']),xy(point))*111000<1000),None)
 details={'reading':prop.get('施設名よみ',''),'lengthM':prop.get('橋長（ｍ）',''),'widthM':prop.get('幅員（ｍ）',''),'officialRoadName':road,'manager':prop.get('管理者名',''),'officialPoint':row['point'],'matchingDistanceM':round(dist)}
 if existing:
  existing.setdefault('path',way['geometry']);existing['structureDetails']=details;continue
 # Do not rename an existing bridge at the same segment without resolving the name difference.
 if any(way['id'] in e.get('osmWays',[]) for e in old['routes'][key] if e['type']=='bridge'):continue
 e={'name':name,'type':'bridge','point':point,'path':way['geometry'],'osmWays':[way['id']],'source':'OpenStreetMap motorway bridge geometry; MLIT/Q地図 2024 facility name','structureDetails':details};old['routes'][key].append(e);added.append({'road':key,'name':name,'point':point,'matchingDistanceM':round(dist)})
for k in keys:old['routes'][k].sort(key=lambda e:(e['type'],e['name']))
old['sources'][0]['snapshot']='2026-10-02';old['generatedAt']='2026-10-04';old['audit']={'date':'2026-10-04','scope':keys,'bridgeTiles':official['tiles'],'failedBridgeTiles':len(official['failures']),'newBridgeRecords':len(added),'unresolvedBridgeRecords':len(unmatched),'note':'Name/geometry matching is a reference; not a complete official inventory or certified portal survey.'}
json.dump(old,open('enriched-landmarks.json','w'),ensure_ascii=False,separators=(',',':'));json.dump({'added':added,'unresolved':unmatched,'failures':official['failures']},open('structure-audit.json','w'),ensure_ascii=False,indent=2)
print('added',len(added),'unresolved',len(unmatched));print(added[:20]);print(collections.Counter(e['road'] for e in added))
