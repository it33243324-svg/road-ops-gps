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
  const km = (a, b) => {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  function locateEvents(events) {
    KPMAPTrafficLocation.resolveEvents(events, D, window.KPMAP_TRAFFIC_LANDMARKS || { routes: {} }, routeByName);
  }

  function listPriority(event) {
    if (['closed', 'accident', 'broken', 'falling'].includes(event.category)) return 0;
    if (/工事|作業/.test(event.reason || '') || ['oneLane', 'laneRestriction', 'underRegulation'].includes(event.category)) return 2;
    return 1;
  }

  function colorFor(category) {
    if (['closed', 'accident', 'broken', 'falling'].includes(category)) return '#ff4f5e';
    if (category === 'jam') return '#ff6f32';
    if (['oneLane', 'laneRestriction', 'underRegulation'].includes(category)) return '#8aca00';
    if (category === 'ramp') return '#ffb23f';
    return '#53c8f5';
  }
  const directionLabel = value => String(value || '').split(/[：:]/)[0].trim();

  function popupHtml(event) {
    return '<strong>' + escapeHtml(event.road) + '</strong><br>' + escapeHtml(event.title) +
      '<br>' + [event.categoryLabel, directionLabel(event.direction), event.reason, event.detail].filter(Boolean).map(escapeHtml).join(' ・ ') +
      (event.mapLocationNote ? '<br><small>' + escapeHtml(event.mapLocationNote) + '</small>' : '');
  }
  const isRestriction = event => ['oneLane', 'laneRestriction', 'underRegulation'].includes(event.category) ||
    (event.category !== 'closed' && /工事|作業/.test(event.reason || ''));

  function signFor(event) {
    const category = event.category;
    const lane = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 27V18L15 10V5M24 5V27" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M17 16V27" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M10 5h10l-5 6z" fill="currentColor"/></svg>';
    const alternating = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 27V6m-5 5 5-5 5 5M23 5v21m-5-5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const symbols = { closed: '×', ramp: '×', accident: '!', broken: '!', falling: '!', jam: '渋' };
    const warning = ['accident', 'broken', 'falling', 'closed', 'ramp'].includes(category);
    return { html: category === 'oneLane' ? alternating : isRestriction(event) ? lane : symbols[category] || '!', warning };
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
      const priority = { closed: 0, accident: 1, broken: 2, falling: 3 };
      const events = group.events.slice().sort((a, b) => (priority[a.category] ?? 10) - (priority[b.category] ?? 10));
      const sign = signFor(events[0]);
      const baseSize = events.length > 1 ? 36 : 32;
      const scale = map.getZoom() < 13 ? .75 : map.getZoom() < 15 ? .875 : 1;
      const size = Math.round(baseSize * scale);
      const label = events.length > 1 ? '<span class="traffic-cluster-symbol">' + sign.html + '</span><b class="traffic-cluster-count">' + events.length + '</b>' : sign.html;
      const icon = L.divIcon({
        className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        html: '<span class="traffic-pin' + (sign.warning ? ' warning' : '') + (events.length > 1 ? ' multi' : '') +
          '" style="transform:scale(' + (size / baseSize) + ');transform-origin:top left" role="img" aria-label="' + escapeHtml(events.length > 1 ? '交通情報 ' + events.length + '件' : events[0].categoryLabel) + '">' + label + '</span>'
      });
      const marker = L.marker(group.center, { pane: 'trafficPane', icon, zIndexOffset: 5000 });
      marker.bindPopup(events.map(popupHtml).join('<hr>'));
      marker.addTo(trafficLayer);
      for (const event of events) event.mapMarker = marker;
    }
    const placed = trafficData.filter(e => e.mapPoint).length;
    meta.textContent = '地図 ' + placed + '件 ・ 一覧は現在地周辺' + (placed < trafficData.length ? ' ・ 位置未確認 ' + (trafficData.length - placed) + '件' : '');
  }

  function unresolvedHtml() {
    const unknown = trafficData.filter(e => !e.mapPoint).sort((a, b) => listPriority(a) - listPriority(b));
    if (!unknown.length) return '';
    return '<details class="traffic-unresolved"><summary>位置未確認 ' + unknown.length + '件（周辺かどうかは不明）</summary>' +
      unknown.map(event => '<article class="traffic-card"><div class="traffic-loc">' + escapeHtml(event.road) + '　' +
        escapeHtml(event.title) + '</div><div class="traffic-tags">' +
        [event.categoryLabel, directionLabel(event.direction), event.reason, event.detail].filter(Boolean).map(escapeHtml).join(' ・ ') +
        '</div><small>施設の位置を確認中です</small></article>').join('') + '</details>';
  }

  function renderList() {
    if (!userLocation) {
      count.textContent = '現在地待ち';
      list.innerHTML = '<div class="traffic-empty">周辺の詳細を見るには、地図の「現在地」ボタンを押してね📍 地図には位置を確認できた情報を表示中だよ。</div>' + unresolvedHtml();
      return;
    }
    const radius = Number(radiusSelect.value) || 20;
    const nearby = trafficData.filter(e => e.mapPoint && km(userLocation, e.mapPoint) <= radius)
      .sort((a, b) => listPriority(a) - listPriority(b) || km(userLocation, a.mapPoint) - km(userLocation, b.mapPoint));
    count.textContent = nearby.length + '件（' + radius + 'km以内）';
    list.innerHTML = nearby.length ? nearby.map((event, index) =>
      '<article class="traffic-card" data-index="' + index + '" style="border-left-color:' + colorFor(event.category) + '">' +
      '<div class="traffic-loc">' + escapeHtml(event.road) + '　' + escapeHtml(event.title) + '</div>' +
      '<div class="traffic-tags">' +
      [event.categoryLabel, directionLabel(event.direction), event.reason, event.detail].filter(Boolean)
        .map(tag => '<span class="traffic-tag">' + escapeHtml(tag) + '</span>').join('') +
      '</div></article>'
    ).join('') : '<div class="traffic-empty">現在地から' + radius + 'km以内に交通情報はありません。</div>';
    list.innerHTML += unresolvedHtml();
    list.querySelectorAll('.traffic-card[data-index]').forEach((card, index) => card.addEventListener('click', () => {
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
    } catch (error) {
      console.error('KPMAP traffic', error);
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


