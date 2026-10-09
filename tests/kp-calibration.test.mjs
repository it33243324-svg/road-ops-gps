import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditKpRoutes, calibrateKp } from '../kp-calibration.mjs';

const html = fs.readFileSync(process.argv[2] || 'dist/index.html', 'utf8');
const routes = JSON.parse(html.match(/const D=(.*?),\$=x=>/)[1]);
const anchors = JSON.parse(fs.readFileSync('kp-ledger-anchors.json'));
const report = JSON.parse(fs.readFileSync('dist/kp-calibration-report.json'));
const audited = auditKpRoutes(routes);
assert.equal(Object.values(audited).reduce((sum, r) => sum + r.count, 0), 8682);
assert.equal(report.regions.length, 5);
assert.equal(report.regions.reduce((sum, r) => sum + r.changed, 0), 394);
assert.equal(routes.chugoku.kpCorrections[0].method, 'mainline-reference-interpolation');
assert.equal(routes.hiroshima_iwakuni.kpCalibration.end, 1.5);

// Independent straight-segment projection onto the emitted 0.1 KP polyline.
// Measure along-road KP error separately from lateral carriageway distance.
function nearestKp(marks, point) {
  const sx = Math.cos(point[0] * Math.PI / 180);
  let bestDistance = Infinity, bestKp;
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1], b = marks[i];
    const x = (b[2] - a[2]) * sx, y = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[1] - a[2]) * sx * x + (point[0] - a[1]) * y) / (x * x + y * y)));
    const d = ((a[2] + t * (b[2] - a[2]) - point[1]) * sx) ** 2 +
      (a[1] + t * (b[1] - a[1]) - point[0]) ** 2;
    if (d < bestDistance) { bestDistance = d; bestKp = a[0] + t * (b[0] - a[0]); }
  }
  return bestKp;
}
for (const region of anchors.regions) for (const anchor of region.anchors) {
  assert(Math.abs(nearestKp(routes[region.road].marks, anchor.point) - anchor.kp) < .003,
    `${anchor.name}: emitted KP must agree with bridge-end stationing within the 0.1 KP interpolation tolerance`);
}

const keys = ['sanyo', 'chugoku', 'hiroshima', 'hiroshima_iwakuni'];
const synthetic = () => Object.fromEntries(keys.map(key => [key, {
  marks: Array.from({ length: 21 }, (_, i) => [i / 10, 34 + i * .0009, 132]),
  segs: [[[34, 132], [34.018, 132]]]
}]));
const spec = { method: 'test', note: 'test', regions: [{ road: 'sanyo', start: 0, end: 2,
  anchors: [{ name: 'reference', kp: 1.1, expectedOriginalKp: 1, point: [34.009, 132] }] }] };
const data = synthetic(), before = structuredClone(data);
calibrateKp(data, spec);
assert.deepEqual(data.sanyo.marks[0], before.sanyo.marks[0]);
assert.deepEqual(data.sanyo.marks.at(-1), before.sanyo.marks.at(-1));
assert.deepEqual(data.sanyo.segs, before.sanyo.segs, 'Road geometry must not change');
for (const key of keys.slice(1)) assert.deepEqual(data[key], before[key], 'Unrelated roads must not change');
assert(Math.abs(data.sanyo.marks.find(m => m[0] === 1.1)[1] - 34.009) < 1e-6);

const bad = synthetic(); bad.sanyo.marks[5][0] = .8;
assert.throws(() => calibrateKp(bad, spec), /missing, duplicate or reversed/);
const jump = synthetic(); jump.chugoku.marks[5][1] += .1;
assert.throws(() => calibrateKp(jump, spec), /abnormal KP spacing/);
const movedReference = structuredClone(spec); movedReference.regions[0].anchors[0].point = [34.009, 132.01];
assert.throws(() => calibrateKp(synthetic(), movedReference), /more than 50m/);
const stale = structuredClone(spec); stale.regions[0].anchors[0].expectedOriginalKp = 1.2;
assert.throws(() => calibrateKp(synthetic(), stale), /upstream KP references changed/);
const reversed = structuredClone(spec); reversed.regions[0].anchors.push({ name: 'reversed', kp: 1.2,
  expectedOriginalKp: .9, point: [34.0081, 132] });
assert.throws(() => calibrateKp(synthetic(), reversed), /Invalid or overly stretched/);
console.log('PASS: all 8,682 KP records, 14 independent bridge anchors, continuous stationing, unchanged geometry and invalid-reference guards');
