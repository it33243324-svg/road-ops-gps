(function (root) {
  'use strict';
  const rad = Math.PI / 180, radius = 6371;
  function distanceKm(a, b) {
    const h = Math.sin((b[0] - a[0]) * rad / 2) ** 2 + Math.cos(a[0] * rad) *
      Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2;
    return radius * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const valid = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
  function build(items) {
    if (!items.length) return null;
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
    for (const item of items) {
      south = Math.min(south, item.south); north = Math.max(north, item.north);
      west = Math.min(west, item.west); east = Math.max(east, item.east);
    }
    const node = { south, north, west, east };
    if (items.length <= 12) { node.items = items; return node; }
    const longitude = (east - west) * .82 > north - south;
    items.sort((a, b) => longitude ? a.west + a.east - b.west - b.east : a.south + a.north - b.south - b.north);
    const half = items.length >> 1;
    node.left = build(items.slice(0, half)); node.right = build(items.slice(half));
    return node;
  }
  // Conservative spherical lower bound, not an approximate nearest-distance
  // metric: a subtree may only be skipped when it cannot contain the winner.
  function lowerBound(node, point) {
    if (!node) return Infinity;
    const latGap = Math.max(node.south - point[0], 0, point[0] - node.north);
    const lngGap = Math.max(node.west - point[1], 0, point[1] - node.east);
    // For distant/date-line queries, use latitude alone rather than risk an
    // overestimate. Supported China-region geometry never crosses the date line.
    const lngBound = lngGap < 90 ? Math.asin(Math.min(1,
      Math.abs(Math.cos(point[0] * rad) * Math.sin(lngGap * rad)))) * radius : 0;
    return Math.max(latGap * rad * radius, lngBound);
  }
  function nearest(tree, point, evaluate) {
    if (!valid(point) || !tree) return null;
    let best = null;
    function visit(node) {
      if (!node || (best && lowerBound(node, point) > best.distance + 1e-10)) return;
      if (node.items) {
        for (const item of node.items) {
          const candidate = evaluate(item);
          if (!best || candidate.distance < best.distance ||
            (candidate.distance === best.distance && candidate.index < best.index)) best = candidate;
        }
      } else {
        const left = lowerBound(node.left, point), right = lowerBound(node.right, point);
        if (left <= right) { visit(node.left); visit(node.right); }
        else { visit(node.right); visit(node.left); }
      }
    }
    visit(tree); return best;
  }
  const segmentCache = new WeakMap(), markCache = new WeakMap();
  function segmentTree(route) {
    const source = route?.segs;
    if (!source) return null;
    if (segmentCache.has(source)) return segmentCache.get(source);
    const items = [];
    for (const line of source) for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      if (valid(a) && valid(b)) items.push({ a, b, index: items.length,
        south: Math.min(a[0], b[0]), north: Math.max(a[0], b[0]),
        west: Math.min(a[1], b[1]), east: Math.max(a[1], b[1]) });
    }
    const tree = build(items); segmentCache.set(source, tree); return tree;
  }
  function nearestOnRoute(route, point) {
    if (!valid(point)) return null;
    const cos = Math.cos(point[0] * rad);
    return nearest(segmentTree(route), point, ({ a, b, index }) => {
      const ax = (a[1] - point[1]) * cos, ay = a[0] - point[0];
      const dx = (b[1] - a[1]) * cos, dy = b[0] - a[0], den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
      const foot = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      return { point: foot, distance: distanceKm(point, foot), index };
    });
  }
  function marksFor(route) {
    const source = route?.marks;
    if (!source) return { marks: [], tree: null };
    if (markCache.has(source)) return markCache.get(source);
    const marks = source.slice().sort((a, b) => a[0] - b[0]);
    const tree = build(marks.map((mark, index) => ({ mark, index, south: mark[1], north: mark[1], west: mark[2], east: mark[2] })));
    const result = { marks, tree }; markCache.set(source, result); return result;
  }
  function nearestKp(route, point) {
    const { tree } = marksFor(route);
    return nearest(tree, point, ({ mark, index }) => ({ value: mark[0], index,
      distance: distanceKm(point, [mark[1], mark[2]]) }));
  }
  // Exact inclusive rectangle lookup, reusing the same index as nearest KP.
  // Return KP order so label insertion and overlap behavior stay deterministic.
  function marksInBounds(route, bounds) {
    if (!bounds || !['south', 'north', 'west', 'east'].every(key => Number.isFinite(bounds[key]))) return [];
    const {south, north, west, east} = bounds;
    if (south > north || west > east) return [];
    const found = [];
    function visit(node) {
      if (!node || node.north < south || node.south > north || node.east < west || node.west > east) return;
      if (node.items) {
        for (const item of node.items) if (item.south >= south && item.north <= north && item.west >= west && item.east <= east) found.push(item);
      } else { visit(node.left); visit(node.right); }
    }
    visit(marksFor(route).tree);
    found.sort((a, b) => a.index - b.index);
    return found.map(item => item.mark);
  }
  const api = { nearestOnRoute, nearestKp, marksInBounds, sortedMarks: route => marksFor(route).marks };
  root.KPMAPSpatial = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
