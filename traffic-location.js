(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC')
    .replace(/TN/gi, 'トンネル').replace(/インターチェンジ/g, 'IC')
    .replace(/ジャンクション/g, 'JCT').replace(/サービスエリア/g, 'SA')
    .replace(/パーキングエリア/g, 'PA').replace(/バスストップ/g, 'バス停')
    .replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const distance = (a, b) => {
    const rad = v => v * Math.PI / 180;
    const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
      Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  function midpoint(path) {
    if (!path?.length) return null;
    const lengths = path.map((p, i) => i ? distance(path[i - 1], p) : 0);
    let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
    for (let i = 1; i < path.length; i++) {
      if (remaining <= lengths[i]) {
        const t = lengths[i] ? remaining / lengths[i] : 0;
        return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
          path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
      }
      remaining -= lengths[i];
    }
    return path[0];
  }
  function project(line, point) {
    let best = null;
    const cos = Math.cos(point[0] * Math.PI / 180);
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const dx = (b[1] - a[1]) * cos, dy = b[0] - a[0];
      const px = (point[1] - a[1]) * cos, py = point[0] - a[0];
      const den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, (px * dx + py * dy) / den)) : 0;
      const ll = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const error = distance(point, ll);
      if (!best || error < best.error) best = { point: ll, position: i - 1 + t, error };
    }
    return best;
  }
  const chainsCache = new WeakMap();
  function roadChains(route) {
    if (chainsCache.has(route)) return chainsCache.get(route);
    const chains = [];
    for (const segment of route.segs || []) {
      if (segment.length < 2) continue;
      const last = chains[chains.length - 1];
      if (last && distance(last[last.length - 1], segment[0]) < 0.15) last.push(...segment.slice(1));
      else chains.push(segment.slice());
    }
    chainsCache.set(route, chains);
    return chains;
  }
  function intervalPath(route, start, end) {
    let best = null;
    for (const line of roadChains(route)) {
      const a = project(line, start), b = project(line, end);
      if (!a || !b || a.error > 0.75 || b.error > 0.75) continue;
      if (!best || a.error + b.error < best.error) best = { line, a, b, error: a.error + b.error };
    }
    if (!best) return null;
    let { a, b } = best;
    const reverse = a.position > b.position;
    if (reverse) [a, b] = [b, a];
    const path = [a.point];
    for (let i = Math.floor(a.position) + 1; i < b.position; i++) path.push(best.line[i]);
    path.push(b.point);
    if (reverse) path.reverse();
    // Preserve the actual reported portals; route geometry can be simplified.
    path[0] = start;
    path[path.length - 1] = end;
    return path;
  }
  const indexCache = new WeakMap();
  function indexFor(route, landmarks) {
    if (indexCache.has(route)) return indexCache.get(route);
    const entries = [...(landmarks || []), ...(route.facilities || []).map(f => ({
      name: f.name, type: f.type, point: [f.lat, f.lng], source: 'HighwayOrderedDS'
    }))];
    const index = [];
    for (const entry of entries) {
      const names = [entry.name, ...(entry.aliases || [])];
      if (entry.type !== 'tunnel' && entry.type !== 'bridge') names.push(entry.name.replace(/\/(?:SIC|IC)$/i, ''));
      for (const name of names) {
        const key = normalize(name);
        if (key.length >= 2) index.push({ key, entry });
      }
    }
    index.sort((a, b) => b.key.length - a.key.length);
    indexCache.set(route, index);
    return index;
  }
  function matchEndpoint(route, landmarks, title, direction) {
    const text = normalize(title);
    const index = indexFor(route, landmarks);
    const hit = index.find(item => text.startsWith(item.key));
    if (!hit) return null;
    const duplicates = index.filter(item => item.key === hit.key);
    if (duplicates.some(item => distance(item.entry.point, hit.entry.point) > 2)) return null;
    const entry = hit.entry;
    const suffix = text.slice(hit.key.length);
    const variants = entry.variants || [];
    const variant = variants.find(v => v.direction === direction);
    const portal = suffix.includes('出口') ? 'exit' : suffix.includes('入口') ? 'entry' : null;
    let point = variant?.path?.length ? midpoint(variant.path) : entry.point;
    let portalKnown = false;
    if (portal && variant?.[portal]) {
      point = variant[portal];
      portalKnown = true;
    } else if (portal && !direction && variants.length === 1 && variants[0][portal] && variants[0].direction) {
      point = variants[0][portal];
      portalKnown = true;
    }
    if (entry.source === 'HighwayOrderedDS') {
      const nearest = roadChains(route).map(line => project(line, point)).filter(Boolean).sort((a, b) => a.error - b.error)[0];
      if (nearest && nearest.error <= 0.75) point = nearest.point;
    }
    return { point, entry, portal, portalKnown, nearby: /付近|先|手前/.test(title) };
  }
  function resolveEvents(events, routes, catalogue, routeByName) {
    for (const event of events) {
      delete event.mapPoint;
      delete event.mapPath;
      delete event.mapPathApproximate;
      const routeKey = routeByName[event.road], route = routes[routeKey];
      event.mapQuality = 'unresolved';
      event.mapLocationNote = '施設名の位置を確認できていません';
      if (!route) continue;
      const direction = /^上り/.test(event.direction) ? 'up' : /^下り/.test(event.direction) ? 'down' : null;
      const parts = String(event.title || '').split(/→|〜|～/).map(p => p.trim()).filter(Boolean);
      const landmarks = catalogue.routes?.[routeKey] || [];
      const endpoints = parts.map(part => matchEndpoint(route, landmarks, part, direction));
      const found = endpoints.filter(Boolean);
      if (parts.length === 2 && found.length === 2) {
        const sameTunnel = found[0].entry === found[1].entry && found[0].entry.type === 'tunnel';
        const variant = sameTunnel && found[0].entry.variants?.find(v => v.direction === direction);
        const path = sameTunnel && variant?.path?.length ? intervalPath({ segs: [variant.path] }, found[0].point, found[1].point) : intervalPath(route, found[0].point, found[1].point);
        if (path) {
          event.mapPoint = midpoint(path);
          event.mapPath = path;
          event.mapQuality = 'interval';
          event.mapLocationNote = '施設・TNの端点を照合した区間の代表位置';
        } else {
          event.mapPoint = found[0].point;
          event.mapQuality = 'partial';
          event.mapLocationNote = '区間の始点付近（区間内の詳細位置は不明）';
        }
      } else if (found.length) {
        const match = found[0];
        event.mapPoint = match.point;
        event.mapQuality = parts.length > 1 ? 'partial' : match.portalKnown ? 'portal' : 'landmark';
        event.mapLocationNote = parts.length > 1 ? '確認できた区間端点の参考位置' :
          match.portalKnown ? 'TNの' + (match.portal === 'entry' ? '入口' : '出口') + (match.nearby ? '付近の参考位置' : 'を照合した参考位置') :
          '施設・TN付近の参考位置';
      } else {
        const kp = String(event.title || '').normalize('NFKC').match(/(\d+(?:\.\d+)?)\s*(?:KP|キロポスト)/i);
        if (kp && route.marks?.length) {
          const value = Number(kp[1]);
          const mark = route.marks.reduce((a, b) => Math.abs(b[0] - value) < Math.abs(a[0] - value) ? b : a);
          if (Math.abs(mark[0] - value) <= 0.1) {
            event.mapPoint = [mark[1], mark[2]];
            event.mapQuality = 'kp';
            event.mapLocationNote = '交通情報のKPから照合した参考位置';
          }
        }
      }
    }
    return events;
  }
  root.KPMAPTrafficLocation = { resolveEvents, normalize, midpoint, matchEndpoint, intervalPath };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KPMAPTrafficLocation;
})(typeof window !== 'undefined' ? window : globalThis);
