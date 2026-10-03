import osmium, json
ways, points = [], []
highway_nodes = set()
processor = osmium.FileProcessor('chugoku.osm.pbf').with_locations().with_filter(osmium.filter.KeyFilter('highway'))
for obj in processor:
    highway = obj.tags.get('highway')
    if isinstance(obj, osmium.osm.Node):
        if highway in ['bus_stop', 'motorway_junction', 'services', 'rest_area'] and obj.tags.get('name'):
            points.append({'id': obj.id, 'tags': dict(obj.tags), 'point': [obj.location.lat, obj.location.lon]})
    elif isinstance(obj, osmium.osm.Way):
        tags = dict(obj.tags)
        if highway in ['motorway','motorway_link','trunk','trunk_link','service']:
            highway_nodes.update(n.ref for n in obj.nodes)
        structure = highway in ['motorway', 'motorway_link', 'trunk', 'trunk_link'] and (
            tags.get('tunnel') not in [None, 'no'] or tags.get('bridge') not in [None, 'no'])
        if structure or highway in ['services', 'rest_area']:
            geometry = [[n.lat, n.lon] for n in obj.nodes if n.location.valid()]
            if len(geometry) > 1:
                ways.append({'id': obj.id, 'tags': tags, 'nodes': [n.ref for n in obj.nodes], 'geometry': geometry})
for point in points:
    if point['tags'].get('highway') == 'bus_stop':
        point['onHighwayWay'] = point['id'] in highway_nodes
json.dump({'ways': ways, 'points': points}, open('osm-landmarks-fast.json', 'w'), ensure_ascii=False)
print('Extracted', len(ways), 'ways and', len(points), 'named points', flush=True)
for w in ways:
    if any(name in str(w['tags']) for name in ['米満', '塩納', '龍王山', '大仁子', '大佐']):
        print(w['id'],w['tags'],w['geometry'][0],w['geometry'][-1],flush=True)
