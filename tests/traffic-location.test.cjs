const assert = require('node:assert/strict');
const fs = require('node:fs');
const locate = require('../traffic-location.js');
const catalogue = require('../traffic-landmarks.json');
const html = fs.readFileSync(process.argv[2] || 'dist/index.html', 'utf8');
const routes = JSON.parse(html.match(/const D=(.*?),\$=x=>/s)[1]);
const byName = {'山陽道':'sanyo','中国道':'chugoku','岡山道':'okayama','米子道':'yonago','広島道':'hiroshima','広島呉道路':'hiroshima_kure','山陰道':'sanin'};
const events = JSON.parse(fs.readFileSync(__dirname + '/fixtures/traffic-2026-10-03.json')).events;
locate.resolveEvents(events, routes, catalogue, byName);
assert.equal(events.length, 42);
assert.equal(events.filter(e => e.mapPoint).length, 42, 'All real events must remain available');
const numata = events.find(e => e.title.includes('沼田'));
for (const e of events.filter(e => /塩納|龍王山/.test(e.title))) {
  assert(e.mapPoint[1] > 134 && e.mapPoint[0] > 34.7, 'Okayama tunnels must not be at Numata');
  assert(Math.abs(e.mapPoint[1] - numata.mapPoint[1]) > 1.5);
}
for (const e of events.filter(e => /米満/.test(e.title))) assert(e.mapPoint[1] > 132.7 && e.mapPoint[1] < 132.74);
for (const name of ['米満トンネル','塩納トンネル','龍王山トンネル']) {
  const entry = catalogue.routes.sanyo.find(e => e.name === name);
  for (const direction of ['up','down']) {
    const variant = entry.variants.find(v => v.direction === direction);
    assert(variant, name + ' must have both carriageways');
    assert.deepEqual(locate.matchEndpoint(routes.sanyo, catalogue.routes.sanyo, name.replace('トンネル','TN') + '出口付近', direction).point, variant.exit);
    assert.deepEqual(locate.matchEndpoint(routes.sanyo, catalogue.routes.sanyo, name + '入口', direction).point, variant.entry);
  }
}
const unknown = {road:'山陽道',title:'まだ登録していないTN付近',direction:'下り',mapX:2502,mapY:7082,mapPoint:numata.mapPoint};
locate.resolveEvents([unknown],routes,catalogue,byName);
assert.equal(unknown.mapQuality,'unresolved');
assert.equal(unknown.mapPoint,undefined,'Unknown positions must not inherit another event or schematic coordinates');
const unrecorded=[419.4,418.8].map(kp=>({road:'山陽道',title:kp+'KP付近',direction:'下り'}));
locate.resolveEvents(unrecorded,routes,catalogue,byName);
for(const event of unrecorded){assert.equal(event.mapPoint,undefined,'Unrecorded KP traffic must not clamp to a road endpoint');assert.equal(event.mapQuality,'unresolved');assert(event.mapLocationNote.includes('未収録'));}
const covered={road:'山陽道',title:'418.7KP付近',direction:'下り'};
locate.resolveEvents([covered],routes,catalogue,byName);assert.equal(covered.mapQuality,'kp');
assert.equal(locate.normalize('米満ﾄﾝﾈﾙ'),locate.normalize('米満TN'));
const bend = {segs:[[[34,132],[34.02,132],[34.02,132.04]]]};
const path = locate.intervalPath(bend,[34,132],[34.02,132.04]);
assert.deepEqual(path, bend.segs[0]);
const mid = locate.midpoint(path);
assert.equal(mid[0],34.02,'Interval midpoint must follow the road rather than cut across the bend');
const reverse = locate.intervalPath(bend,[34.02,132.04],[34,132]);
assert.deepEqual(reverse,path.slice().reverse());
console.log('PASS: 42 real events, separated tunnel locations, both-direction portals, aliases, unknown positions and road intervals');
