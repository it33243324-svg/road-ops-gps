// Build-time calibration only. Runtime consumers share the resulting marks.
// Ledger KP and geographic bridge endpoints are separate reference sources;
// the result remains a common-road reference, not surveyed carriageway KP.
export const distanceKm = (a, b) => {
  const rad = Math.PI / 180;
  const z = Math.sin((b[0] - a[0]) * rad / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(z)));
};

export function auditKpRoutes(data, keys = ['sanyo', 'chugoku', 'hiroshima', 'hiroshima_iwakuni']) {
  const report = {};
  for (const key of keys) {
    const marks = data[key]?.marks;
    if (!marks?.length) throw Error(`${key}: KP data missing`);
    let minSpacingM = Infinity, maxSpacingM = 0;
    for (let i = 0; i < marks.length; i++) {
      const p = marks[i];
      if (p.length !== 3 || !p.every(Number.isFinite) || p[1] < 33 || p[1] > 36 || p[2] < 130 || p[2] > 136)
        throw Error(`${key}: invalid KP coordinate at ${i}`);
      if (!i) continue;
      const prev = marks[i - 1];
      if (Math.abs(p[0] - prev[0] - .1) > 1e-7)
        throw Error(`${key}: missing, duplicate or reversed KP ${prev[0]} -> ${p[0]}`);
      const d = distanceKm(prev.slice(1), p.slice(1)) * 1000;
      // This bound detects collapsed coordinates and severe jumps; it does not
      // certify that every 100m station is surveyed or correctly anchored.
      if (d < 50 || d > 150) throw Error(`${key}: abnormal KP spacing ${prev[0]} -> ${p[0]} (${d.toFixed(1)}m)`);
      minSpacingM = Math.min(minSpacingM, d); maxSpacingM = Math.max(maxSpacingM, d);
    }
    report[key] = { count: marks.length, start: marks[0][0], end: marks.at(-1)[0],
      minSpacingM: +minSpacingM.toFixed(1), maxSpacingM: +maxSpacingM.toFixed(1) };
  }
  return report;
}

function roadLine(route) {
  const points = [], distances = [];
  for (const seg of route.segs) for (let i = 0; i < seg.length; i++) {
    const p = seg[i], last = points.at(-1);
    if (last && i === 0 && distanceKm(last, p) > .003)
      throw Error('Mainline geometry has an unconnected segment');
    if (last && distanceKm(last, p) < 1e-8) continue;
    distances.push(last ? distances.at(-1) + distanceKm(last, p) : 0);
    points.push(p);
  }
  if (points.length < 2) throw Error('Mainline geometry missing');
  return { points, distances };
}

function project(line, point) {
  const sx = Math.cos(point[0] * Math.PI / 180), sy = 1;
  let best = { distance: Infinity };
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1], b = line.points[i];
    const dx = (b[1] - a[1]) * sx, dy = (b[0] - a[0]) * sy;
    const den = dx * dx + dy * dy;
    const t = den ? Math.max(0, Math.min(1, ((point[1] - a[1]) * sx * dx + (point[0] - a[0]) * sy * dy) / den)) : 0;
    const foot = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const distance = distanceKm(point, foot);
    if (distance < best.distance) best = { distance, position: line.distances[i - 1] +
      (line.distances[i] - line.distances[i - 1]) * t };
  }
  return best;
}

function pointAt(line, position) {
  let lo = 1, hi = line.distances.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (line.distances[m] < position) lo = m + 1; else hi = m; }
  const a = line.points[lo - 1], b = line.points[lo], d = line.distances[lo] - line.distances[lo - 1];
  const t = d ? (position - line.distances[lo - 1]) / d : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function calibrateKp(data, catalogue) {
  const before = auditKpRoutes(data), reports = [], lines = new Map();
  const applied = new Map();
  for (const region of catalogue.regions) {
    const route = data[region.road];
    if (!route || !(region.start < region.end)) throw Error('Invalid KP calibration region');
    const intervals = applied.get(region.road) || [];
    if (intervals.some(([a, b]) => region.start < b && region.end > a)) throw Error('Overlapping KP calibration regions');
    intervals.push([region.start, region.end]); applied.set(region.road, intervals);
    if (!lines.has(region.road)) lines.set(region.road, roadLine(route));
    const line = lines.get(region.road);
    const original = route.marks.map(p => p.slice());
    const first = original.find(p => p[0] === region.start), last = original.find(p => p[0] === region.end);
    if (!first || !last) throw Error('Calibration region endpoints are not recorded KPs');
    const selected = original.filter(p => p[0] >= region.start && p[0] <= region.end);
    const baseline = selected.map(p => ({ kp: p[0], ...project(line, p.slice(1)) }));
    if (baseline.some((p, i) => p.distance > .003 || (i && p.position <= baseline[i - 1].position)))
      throw Error('Existing KP order does not follow the mainline');
    const controls = [{ kp: region.start, position: baseline[0].position }];
    const anchorChecks = [];
    for (const anchor of region.anchors) {
      if (!(anchor.kp > region.start && anchor.kp < region.end)) throw Error('Anchor is outside calibration region');
      const hit = project(line, anchor.point);
      if (hit.distance > .05) throw Error(`${anchor.name}: reference is more than 50m from the existing mainline`);
      let originalKp;
      for (let i = 1; i < baseline.length; i++) if (baseline[i].position >= hit.position && baseline[i - 1].position <= hit.position) {
        const a = baseline[i - 1], b = baseline[i];
        originalKp = a.kp + (b.kp - a.kp) * (hit.position - a.position) / (b.position - a.position); break;
      }
      if (!Number.isFinite(originalKp) || Math.abs(originalKp - anchor.expectedOriginalKp) > .03)
        throw Error(`${anchor.name}: upstream KP references changed; recheck the calibration`);
      controls.push({ kp: anchor.kp, position: hit.position });
      anchorChecks.push({ name: anchor.name, kp: anchor.kp, originalKp: +originalKp.toFixed(4),
        projectionDistanceM: +(hit.distance * 1000).toFixed(1) });
    }
    controls.push({ kp: region.end, position: baseline.at(-1).position });
    const ratios = [];
    for (let i = 1; i < controls.length; i++) {
      const a = controls[i - 1], b = controls[i], ratio = (b.position - a.position) / (b.kp - a.kp);
      if (!(b.kp > a.kp && b.position > a.position) || ratio < .75 || ratio > 1.25)
        throw Error(`Invalid or overly stretched calibration anchors: ${a.kp} -> ${b.kp}`);
      ratios.push(+ratio.toFixed(4));
    }
    let changed = 0, maxMovementM = 0, part = 1;
    for (const mark of route.marks) {
      if (mark[0] <= region.start || mark[0] >= region.end) continue;
      while (part < controls.length - 1 && mark[0] > controls[part].kp) part++;
      const a = controls[part - 1], b = controls[part];
      const p = pointAt(line, a.position + (b.position - a.position) * (mark[0] - a.kp) / (b.kp - a.kp));
      const moved = distanceKm(mark.slice(1), p) * 1000;
      maxMovementM = Math.max(maxMovementM, moved);
      const rounded = p.map(n => +n.toFixed(6));
      if (rounded[0] !== mark[1] || rounded[1] !== mark[2]) changed++;
      mark[1] = rounded[0]; mark[2] = rounded[1];
    }
    const report = { road: region.road, start: region.start, end: region.end, changed,
      maxMovementM: +maxMovementM.toFixed(1), anchors: anchorChecks, ratios };
    reports.push(report);
    route.kpCorrections ||= [];
    route.kpCorrections.push({ start: region.start, end: region.end, method: catalogue.method,
      reference: [...new Set(region.anchors.map(a => a.name.replace(/ (起点|終点)$/, '')))].join('・'),
      note: catalogue.note, changed, maxMovementM: report.maxMovementM });
  }
  const after = auditKpRoutes(data);
  for (const key of Object.keys(before)) if (before[key].count !== after[key].count ||
    before[key].start !== after[key].start || before[key].end !== after[key].end) throw Error('Calibration changed KP coverage');
  return { before, after, regions: reports };
}
