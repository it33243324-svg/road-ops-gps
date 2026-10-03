const assert = require('node:assert/strict');
const p = require('../traffic-presentation.js');
const point = [34.45,132.72];
const event = (category, km, reason = '') => ({category,reason,mapPoint:[point[0]+km/111,point[1]]});
const events = [event('closed',4,'工事'),event('laneRestriction',1,'作業'),event('falling',3),event('broken',2),event('accident',5),event('jam',.5),event('laneRestriction',.2,'事故'),event('unknown',2.5)];
const groups=p.nearbyGroups(events,point,20);
assert.deepEqual(groups.priority.map(x=>x.event.category),['jam','broken','unknown','falling','closed','accident']);
assert.deepEqual(groups.regulation.map(x=>x.event.category),['laneRestriction','laneRestriction']);
assert.deepEqual(['closed','accident','broken','falling','jam','laneRestriction'].map(category=>p.mapRank({category})),[0,1,2,3,4,5]);
assert.equal(p.nearbyGroups(events,point,1.5).count,3);
assert.equal(p.eventAge(undefined),'');
assert.equal(p.eventAge('10:00'),'');
assert.equal(p.eventAge('2026-10-03T01:00:00Z',Date.parse('2026-10-03T01:07:00Z')),'発生から7分');
assert.equal(p.eventAge('2026-10-03T02:00:00Z',Date.parse('2026-10-03T01:07:00Z')),'');
console.log('PASS: priority sections sorted by distance, pane ranking, radius and occurrence-time semantics');

assert(p.isClosure({category:'ramp',detail:'入口閉鎖'}));assert(!p.isClosure({category:'ramp',detail:'車線規制'}));assert.equal(p.mapRank({category:'ramp',detail:'出口閉鎖',reason:'工事'}),0);
