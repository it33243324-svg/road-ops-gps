(() => {
  const list = document.getElementById('trafficList');
  const count = document.getElementById('trafficCount');
  const meta = document.getElementById('trafficMeta');
  const refresh = document.getElementById('trafficRefresh');
  const radiusSelect = document.getElementById('trafficRadius');
  let busy = false;
  let trafficData = [];
  let userLocation = null;
  let trafficLayer = null;
  let zoomHooked = false;

  const routeByName = {
    '山陽道': 'sanyo', '中国道': 'chugoku', '米子道': 'yonago', '岡山道': 'okayama',
    '浜田道': 'hamada', '松江道': 'matsue', '広島道': 'hiroshima', '山陰道': 'sanin',
    '関門橋': 'kanmon_bridge', '瀬戸中央道': 'seto', '西瀬戸道': 'shimanami',
    '広島岩国道路': 'hiroshima_iwakuni', '広島呉道路': 'hiroshima_kure',
    '関門トンネル': 'kanmon_tunnel', '鳥取道': 'tottori', '尾道道': 'onomichi',
    '松永道路': 'matsunaga', '東広島呉道': 'higashihiroshima_kure', '小郡道路': 'ogori'
  };
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const norm = value => String(value || '').normalize('NFKC').replace(/付近|付近等|先/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  const km = (a, b) => {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  const xyCenter = e => Number.isFinite(+e.mapX) && Number.isFinite(+e.mapY) ? [+e.mapY, +e.mapX] : null;

  function titleFacilities(route, title) {
    const parts = String(title || '').split('→').map(norm).filter(Boolean);
    const facilities = route?.facilities || [];
    const found = [];
    for (const part of parts) {
      let best = null, bestLength = 0;
      for (const facility of facilities) {
        const name = norm(facility.name.replace(/\/(SIC|IC)$/i, ''));
        if (name.length >= 3 && (part.includes(name) || name.includes(part)) && name.length > bestLength) {
          best = facility;
          bestLength = name.length;
        }
      }
      if (best && !found.includes(best)) found.push(best);
    }
    return found;
  }

  function snapToRoad(route, point) {
    if (!route || !point) return null;
    let best = null, min = Infinity;
    for (const line of route.segs || []) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i], cos = Math.cos(point[0] * Math.PI / 180);
        const ax = (a[1] - point[1]) * cos, ay = a[0] - point[0];
        const bx = (b[1] - point[1]) * cos, by = b[0] - point[0];
        const dx = bx - ax, dy = by - ay, den = dx * dx + dy * dy;
        const t = den ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
        const candidate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const distance = (ax + dx * t) ** 2 + (ay + dy * t) ** 2;
        if (distance < min) { min = distance; best = candidate; }
      }
    }
    return best;
  }

  function solve3(matrix, vector) {
    const a = matrix.map((row, i) => [...row, vector[i]]);
    for (let col = 0; col < 3; col++) {
      let pivot = col;
      for (let row = col + 1; row < 3; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      if (Math.abs(a[pivot][col]) < 1e-10) return null;
      [a[col], a[pivot]] = [a[pivot], a[col]];
      const div = a[col][col];
      for (let j = col; j < 4; j++) a[col][j] /= div;
      for (let row = 0; row < 3; row++) if (row !== col) {
        const scale = a[row][col];
        for (let j = col; j < 4; j++) a[row][j] -= scale * a[col][j];
      }
    }
    return a.map(row => row[3]);
  }

  function fitProjection(anchors) {
    if (anchors.length < 3) return null;
    const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], lat = [0, 0, 0], lng = [0, 0, 0];
    for (const p of anchors) {
      const row = [p.xy[1], p.xy[0], 1];
      for (let i = 0; i < 3; i++) {
        lat[i] += row[i] * p.ll[0];
        lng[i] += row[i] * p.ll[1];
        for (let j = 0; j < 3; j++) matrix[i][j] += row[i] * row[j];
      }
    }
    const latFit = solve3(matrix, lat), lngFit = solve3(matrix, lng);
    return latFit && lngFit ? xy => [latFit[0] * xy[1] + latFit[1] * xy[0] + latFit[2], lngFit[0] * xy[1] + lngFit[1] * xy[0] + lngFit[2]] : null;
  }

  function locateEvents(events) {
    const anchors = [];
    for (const event of events) {
      const routeKey = routeByName[event.road], route = D[routeKey];
      const xy = xyCenter(event);
      if (!route) continue;
      const matches = titleFacilities(route, event.title);
      if (matches.length) {
        const ll = [matches.reduce((n, f) => n + f.lat, 0) / matches.length, matches.reduce((n, f) => n + f.lng, 0) / matches.length];
        if (xy) anchors.push({ routeKey, xy, ll });
        event.mapPoint = snapToRoad(route, ll) || ll;
        event.mapQuality = 'facility';
      }
    }
    const globalFit = fitProjection(anchors);
    const localFits = new Map();
    for (const key of new Set(anchors.map(a => a.routeKey))) localFits.set(key, fitProjection(anchors.filter(a => a.routeKey === key)));
    for (const event of events) {
      if (event.mapPoint) continue;
      const routeKey = routeByName[event.road], route = D[routeKey], xy = xyCenter(event);
      if (!route) continue;
      const sameRoad = anchors.filter(a => a.routeKey === routeKey);
      let estimate;
      const fit = localFits.get(routeKey) || globalFit;
      if (xy && fit) estimate = fit(xy);
      if (!estimate && xy && sameRoad.length) {
        const nearest = sameRoad.map(a => ({ a, d: Math.hypot(a.xy[0] - xy[0], a.xy[1] - xy[1]) })).sort((a, b) => a.d - b.d).slice(0, 3);
        const weights = nearest.map(x => 1 / Math.max(1, x.d) ** 2), total = weights.reduce((a, b) => a + b, 0);
        estimate = [0, 0];
        nearest.forEach((x, i) => { estimate[0] += x.a.ll[0] * weights[i] / total; estimate[1] += x.a.ll[1] * weights[i] / total; });
      }
      if (!estimate && sameRoad.length) {
        estimate = [sameRoad.reduce((n, a) => n + a.ll[0], 0) / sameRoad.length, sameRoad.reduce((n, a) => n + a.ll[1], 0) / sameRoad.length];
      }
      if (!estimate && routeKey === 'hiroshima_kure') {
        const title = norm(event.title);
        estimate = title.includes('吉浦') ? [34.27161, 132.52482] :
          title.includes('呉トンネル') ? [34.238, 132.542] :
          title.includes('天応') ? [34.263, 132.531] : [34.298, 132.521];
      }
      if (!estimate && routeKey === 'shimanami') estimate = [34.337, 133.16];
      if (!estimate && anchors.length) {
        estimate = [anchors.reduce((n, a) => n + a.ll[0], 0) / anchors.length, anchors.reduce((n, a) => n + a.ll[1], 0) / anchors.length];
      }
      if (!estimate && route.segs?.length) estimate = route.segs.flat()[0];
      event.mapPoint = snapToRoad(route, estimate) || estimate;
      event.mapQuality = 'estimated';
    }
  }

  function colorFor(category) {
    if (['closed', 'accident', 'broken', 'falling'].includes(category)) return '#ff4f5e';
    if (category === 'jam') return '#ff6f32';
    if (['oneLane', 'laneRestriction', 'underRegulation', 'ramp'].includes(category)) return '#ffb23f';
    return '#53c8f5';
  }
  function popupHtml(event) {
    return '<strong>' + escapeHtml(event.road) + '</strong><br>' + escapeHtml(event.title) +
      '<br>' + [event.categoryLabel, event.direction, event.reason, event.detail].filter(Boolean).map(escapeHtml).join(' ・ ') +
      (event.mapQuality === 'estimated' ? '<br><small>地図位置は道路上の参考表示</small>' : '');
  }
  function glyphFor(category) {
    return ({ closed: '閉', accident: '事', broken: '故', falling: '落', jam: '渋',
      oneLane: '交', laneRestriction: '規', underRegulation: '規', ramp: '閉' })[category] || '情';
  }
  function renderMap() {
    if (trafficLayer) trafficLayer.clearLayers();
    else trafficLayer = L.layerGroup().addTo(map);
    if (!map.getPane('trafficPane')) {
      map.createPane('trafficPane');
      map.getPane('trafficPane').style.zIndex = '650';
    }
    if (!zoomHooked) {
      map.on('zoomend', renderMap);
      zoomHooked = true;
    }
    const groups = [];
    for (const event of trafficData) {
      if (!event.mapPoint) continue;
      const pixel = map.latLngToLayerPoint(event.mapPoint);
      let group = null, distance = 46;
      for (const candidate of groups) {
        const center = map.latLngToLayerPoint(candidate.center);
        const d = pixel.distanceTo(center);
        if (d < distance) { group = candidate; distance = d; }
      }
      if (!group) {
        group = { events: [], lat: 0, lng: 0, center: event.mapPoint };
        groups.push(group);
      }
      group.events.push(event);
      group.lat += event.mapPoint[0];
      group.lng += event.mapPoint[1];
      group.center = [group.lat / group.events.length, group.lng / group.events.length];
    }
    for (const group of groups) {
      const events = group.events;
      const color = events.length > 1 ? '#263b45' : colorFor(events[0].category);
      const label = events.length > 1 ? String(events.length) : glyphFor(events[0].category);
      const size = events.length > 1 ? 42 : 38;
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: '<span class="traffic-pin' + (events.length > 1 ? ' multi' : '') + '" style="background:' + color + '">' + label + '</span>'
      });
      const marker = L.marker(group.center, { pane: 'trafficPane', icon, zIndexOffset: 5000 });
      marker.bindPopup(events.map(popupHtml).join('<hr>'));
      marker.addTo(trafficLayer);
      for (const event of events) event.mapMarker = marker;
    }
    const placed = trafficData.filter(e => e.mapPoint).length;
    meta.textContent = '地図に' + placed + '件表示（近い地点は番号でまとめて表示） ・ 一覧は現在地の周辺のみ';
  }

  function renderList() {
    if (!userLocation) {
      count.textContent = '現在地待ち';
      list.innerHTML = '<div class="traffic-empty">周辺の詳細を見るには、地図の「現在地」ボタンを押してね📍 地図には全件表示中だよ。</div>';
      return;
    }
    const radius = Number(radiusSelect.value) || 50;
    const nearby = trafficData.filter(e => e.mapPoint && km(userLocation, e.mapPoint) <= radius)
      .sort((a, b) => km(userLocation, a.mapPoint) - km(userLocation, b.mapPoint));
    count.textContent = nearby.length + '件（' + radius + 'km以内）';
    list.innerHTML = nearby.length ? nearby.map((event, index) =>
      '<article class="traffic-card" data-index="' + index + '" style="border-left-color:' + colorFor(event.category) + '">' +
      '<div class="traffic-loc">' + escapeHtml(event.road) + '　' + escapeHtml(event.title) + '</div>' +
      '<div class="traffic-tags">' +
      [event.categoryLabel, event.direction, event.reason, event.detail].filter(Boolean)
        .map(tag => '<span class="traffic-tag">' + escapeHtml(tag) + '</span>').join('') +
      '</div></article>'
    ).join('') : '<div class="traffic-empty">現在地から' + radius + 'km以内に交通情報はありません。</div>';
    list.querySelectorAll('.traffic-card').forEach((card, index) => card.addEventListener('click', () => {
      const event = nearby[index];
      if (event.mapPoint) {
        map.setView(event.mapPoint, Math.max(map.getZoom(), 14));
        if (event.mapMarker) event.mapMarker.openPopup();
      }
    }));
  }

  async function load() {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    refresh.textContent = '取得中…';
    try {
      const response = await fetch('/api/traffic?ts=' + Date.now(), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '取得エラー');
      trafficData = Array.isArray(data.events) ? data.events : [];
      locateEvents(trafficData);
      renderMap();
      renderList();
    } catch {
      meta.textContent = '交通情報を取得できませんでした。再試行してください。';
    } finally {
      busy = false;
      refresh.disabled = false;
      refresh.textContent = '更新';
    }
  }

  window.addEventListener('kpmap-location', event => {
    userLocation = [event.detail.lat, event.detail.lng];
    renderList();
  });
  radiusSelect.addEventListener('change', renderList);
  refresh.addEventListener('click', load);
  load();
  setInterval(load, 300000);
})();
