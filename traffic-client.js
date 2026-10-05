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
  let intervalRenderer = null;
  let intervalLayer = null;
  let dataSignature = null;
  let badgeSignature = null;
  let mapFrame = 0;
  let zoomHooked = false;
  let lastSuccessfulFetch = 0;
  let savedNew=null;try{savedNew=JSON.parse(sessionStorage.getItem('kpmap-traffic-new')||'null');}catch{}
  const newTracker=KPMAPTrafficNew.create(savedNew);
  const newHtml=event=>newTracker.isNew(event)?'<span class="traffic-new">NEW</span>':'';
  const updated = document.getElementById('trafficUpdated');
  const { distanceKm: km, isRegulation, isClosure, mapRank, nearbyGroups, eventAge } = KPMAPTrafficPresentation;

  const routeByName = { '山陽道': 'sanyo', '中国道': 'chugoku', '広島道': 'hiroshima', '広島岩国道路': 'hiroshima_iwakuni' };
  // Keep the white edge and road identity visible while the alert color fades.
  const intervalStyle = document.createElement('style');
  intervalStyle.id = 'kpmap-traffic-interval-style';
  intervalStyle.textContent = `
    .kpmap-traffic-interval-alert{animation:kpmap-traffic-interval-blink 1s ease-in-out infinite;pointer-events:none}
    @keyframes kpmap-traffic-interval-blink{0%,18%,82%,100%{opacity:0}32%,68%{opacity:1}}
    @media(prefers-reduced-motion:reduce){.kpmap-traffic-interval-alert{animation:none;opacity:1}}
  `;
  document.head.appendChild(intervalStyle);

  function intervalWidth(road) {
    const z = map.getZoom();
    return (routeByName[road] === r.value ? 10 : 7) + (z >= 16 ? 3 : z >= 14 ? 1.5 : 0);
  }
  function updateIntervalWidths() {
    intervalLayer?.eachLayer(line => line.setStyle({
      weight: intervalWidth(line.options.trafficRoad) + (line.options.intervalEdge ? 3 : 0)
    }));
  }
  map.on('zoomend', updateIntervalWidths);
  r.addEventListener('change', updateIntervalWidths);
  function renderIntervals() {
    if (intervalLayer) intervalLayer.clearLayers();
    else intervalLayer = L.layerGroup().addTo(map);
    const intervals = trafficData.filter(event =>
      (event.category === 'jam' || event.category === 'closed') &&
      Array.isArray(event.mapPath) && event.mapPath.length > 1 &&
      event.mapPath.every(point => Array.isArray(point) && point.length >= 2 &&
        Number.isFinite(point[0]) && Number.isFinite(point[1])) &&
      event.mapPath.some(point => km(event.mapPath[0], point) > .005));
    if (!intervals.length) return;
    if (!map.getPane('trafficIntervalPane')) {
      map.createPane('trafficIntervalPane');
      map.getPane('trafficIntervalPane').style.zIndex = '620';
      map.getPane('trafficIntervalPane').style.pointerEvents = 'none';
    }
    if (!intervalRenderer) intervalRenderer = L.svg({ pane: 'trafficIntervalPane', padding: .5 });
    // Closure strokes take precedence where a closure and a jam overlap.
    intervals.sort((a, b) => Number(a.category === 'closed') - Number(b.category === 'closed'));
    for (const event of intervals) {
      const route = D[routeByName[event.road]];
      if (!route?.color) continue;
      const options = { renderer: intervalRenderer, pane: 'trafficIntervalPane',
        interactive: false, lineCap: 'round', lineJoin: 'round', opacity: 1, trafficRoad: event.road };
      const weight = intervalWidth(event.road);
      L.polyline(event.mapPath, { ...options, color: '#fff', weight: weight + 3, intervalEdge: true,
        className: 'kpmap-traffic-interval-edge' }).addTo(intervalLayer);
      L.polyline(event.mapPath, { ...options, color: route.color, weight,
        className: 'kpmap-traffic-interval-road' }).addTo(intervalLayer);
      L.polyline(event.mapPath, { ...options,
        color: event.category === 'jam' ? '#e83d45' : '#17191e', weight,
        className: 'kpmap-traffic-interval-alert' }).addTo(intervalLayer);
    }
  }
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  function locateEvents(events) {
    KPMAPTrafficLocation.resolveEvents(events, D, window.KPMAP_TRAFFIC_LANDMARKS || { routes: {} }, routeByName);
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
    return newHtml(event)+'<strong>' + escapeHtml(event.road) + '</strong><br>' + escapeHtml(event.title) +
      '<br>' + [event.categoryLabel, directionLabel(event.direction), event.reason, event.detail].filter(Boolean).map(escapeHtml).join(' ・ ') +
      (event.mapLocationNote ? '<br><small>' + escapeHtml(event.mapLocationNote) + '</small>' : '') + ageHtml(event);
  }
  const isRestriction = event => ['oneLane', 'laneRestriction', 'underRegulation'].includes(event.category) ||
    (event.category !== 'closed' && /工事|作業/.test(event.reason || ''));

  function signFor(event) {
    const category = event.category;
    const lane = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 27V18L15 10V5M24 5V27" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M17 16V27" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M10 5h10l-5 6z" fill="currentColor"/></svg>';
    const alternating = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 27V6m-5 5 5-5 5 5M23 5v21m-5-5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const symbols = { closed: '×', ramp: '×', accident: '!', broken: '!', falling: '!', jam: KPMAPJamIcons[0].html };
    const warning = ['accident', 'broken', 'falling', 'closed', 'ramp'].includes(category);
    return { closure:isClosure(event), html: isClosure(event)?'×':category === 'oneLane' ? alternating : isRestriction(event) ? lane : symbols[category] || '!', warning };
  }
  function scheduleMap() {
    if (mapFrame) return;
    mapFrame = requestAnimationFrame(() => { mapFrame = 0; renderMap(); });
  }
  function refreshBadges() {
    const signature = trafficData.map(event => newTracker.isNew(event)).join();
    if (signature === badgeSignature) return false;
    badgeSignature = signature;
    return true;
  }
  function renderMap() {
    const uprightPane = map.getPane('markerPane').parentElement;
    const kpPane = map.getPane('kpPane');
    if (kpPane && kpPane.parentElement !== uprightPane) uprightPane.appendChild(kpPane);
    if (!map.getPane('trafficPopupPane')) {
      map.createPane('trafficPopupPane');
      map.getPane('trafficPopupPane').style.zIndex = '750';
      uprightPane.appendChild(map.getPane('trafficPopupPane'));
    }
    if (trafficLayer) trafficLayer.clearLayers();
    else trafficLayer = L.layerGroup().addTo(map);
    if (!map.getPane('trafficPane')) {
      map.createPane('trafficPane');
      map.getPane('trafficPane').style.zIndex = '650';
    }
    if (!zoomHooked) {
      map.on('zoomend rotate', scheduleMap);
      zoomHooked = true;
    }
    const scale = map.getZoom() < 13 ? .75 : map.getZoom() < 15 ? .875 : 1;
    const size = Math.round(32 * scale);
    // Group nearby screen anchors; zooming in naturally separates distinct locations.
    const groups = [];
    for (const event of trafficData) event.mapMarker = null;
    for (const event of trafficData.filter(e=>e.mapPoint).sort((a,b)=>mapRank(a)-mapRank(b))) {
      const point = map.latLngToContainerPoint(event.mapPoint);
      const group = groups.find(events=>{
        const anchor=map.latLngToContainerPoint(events[0].mapPoint);
        return Math.abs(anchor.x-point.x)<size+12 && Math.abs(anchor.y-point.y)<size+12;
      });
      if (group) group.push(event); else groups.push([event]);
    }
    for (const events of groups) {
      const event = events[0];
      const rank = mapRank(event), pane = 'trafficPriority' + rank;
      if (!map.getPane(pane)) {
        map.createPane(pane);
        map.getPane(pane).style.zIndex = String(660 - rank);
        uprightPane.appendChild(map.getPane(pane));
      }
      const sign = signFor(event);
      const markerSize=Math.round((sign.closure?36:32)*scale);
      const icon = L.divIcon({
        className: 'traffic-event-marker', iconSize: [markerSize, markerSize], iconAnchor: [markerSize / 2, markerSize / 2],
          html: '<span class="traffic-pin' + (sign.warning ? ' warning' : '') + (sign.closure ? ' closure effect-color effect-wave' : event.category === 'jam' ? ' jam' : '') +
          '" style="transform:scale(' + scale + ');transform-origin:top left" role="img" aria-label="' +
          escapeHtml(event.categoryLabel + (events.length > 1 ? '・交通情報' + events.length + '件' : '')) + '">' + (sign.closure?'<span class="closure-symbol">'+sign.html+'</span>':sign.html) + '</span>' + (events.length > 1 ? '<span class="traffic-cluster-count">' + events.length + '</span>' : '') + (events.some(e=>newTracker.isNew(e))?'<span class="traffic-map-new">NEW</span>':'')
      });
      const marker = L.marker(event.mapPoint, { pane, icon, zIndexOffset: 5000, keyboard: true,
        title: event.road + ' ' + event.categoryLabel + ' ' + event.title + (events.length > 1 ? '（交通情報' + events.length + '件）' : '') });
      marker.bindPopup(events.length > 1 ? '<strong>近くの交通情報 ' + events.length + '件</strong>' + events.map(e=>'<div class="traffic-shared-event">'+popupHtml(e)+'</div>').join('') : popupHtml(event), { pane: 'trafficPopupPane' });
      marker.addTo(trafficLayer);
      events.forEach(e=>{e.mapMarker = marker;});
    }
    refreshBadges();
    map.fire("trafficrendered");
    updateMapMeta();
  }
  function updateMapMeta() {
    const placed = trafficData.filter(e => e.mapPoint).length;
    meta.textContent = '地図 ' + placed + '件 ・ 一覧は現在地周辺' + (placed < trafficData.length ? ' ・ 位置未確認 ' + (trafficData.length - placed) + '件' : '');
  }

  function unresolvedHtml() {
    const unknown = trafficData.filter(e => !e.mapPoint).sort((a, b) => mapRank(a) - mapRank(b));
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
    const groups = nearbyGroups(trafficData, userLocation, radius);
    count.textContent = groups.count + '件（' + radius + 'km以内）';
    const card = ({ event, distance }, index) =>
      '<button type="button" class="traffic-card" data-event="' + index + '" style="border-left-color:' + colorFor(event.category) + '">' +
      '<span class="traffic-loc">' + newHtml(event) + escapeHtml(event.road) + '　' + escapeHtml(event.title) + '</span>' +
      '<span class="traffic-tags">' +
      [event.categoryLabel, directionLabel(event.direction), event.reason, event.detail].filter(Boolean)
        .map(tag => '<span class="traffic-tag">' + escapeHtml(tag) + '</span>').join('') +
      '<span class="traffic-distance">約' + distance.toFixed(1) + 'km</span></span>' + ageHtml(event) + '</button>';
    const ordered = [...groups.priority, ...groups.regulation];
    let index = 0;
    const groupHtml = (title, entries, css) => entries.length ?
      '<section class="traffic-group ' + css + '"><h3>' + title + '<small>' + entries.length + '件・近い順</small></h3><div class="traffic-group-cards">' +
      entries.map(item => card(item, index++)).join('') + '</div></section>' : '';
    list.innerHTML = groups.count ?
      groupHtml('通行止め・事故・故障車・落下物・その他', groups.priority, 'traffic-priority-group') +
      groupHtml('工事・交通規制', groups.regulation, 'traffic-regulation-group') :
      '<div class="traffic-empty">現在地から' + radius + 'km以内に交通情報はありません。</div>';
    list.innerHTML += unresolvedHtml();
    list.querySelectorAll('[data-event]').forEach(cardEl => cardEl.addEventListener('click', () => {
      const event = ordered[Number(cardEl.dataset.event)].event;
      window.dispatchEvent(new CustomEvent('kpmap-browse-map'));
      map.setView(event.mapPoint, Math.max(map.getZoom(), 14));
      if (event.mapMarker) event.mapMarker.openPopup();
    }));
  }

  function ageHtml(event) {
    const text = eventAge(event.occurredAt);
    return text ? '<small class="traffic-age" data-occurred-at="' + escapeHtml(event.occurredAt) + '">' + text + '</small>' : '';
  }
  function showUpdateTime(timestamp) {
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time)) { updated.textContent = '更新時刻を確認できません'; return; }
    const clock = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(time));
    updated.textContent = clock + ' 更新（取得時刻）';
    updated.dateTime = new Date(time).toISOString();
    updated.title = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time));
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
      const events = (Array.isArray(data.events) ? data.events : []).filter(event => ['山陽道','中国道','広島道','広島岩国道路'].includes(String(event.road || '').trim()));
      const signature = JSON.stringify(events);
      const changed = signature !== dataSignature;
      if (changed) trafficData = events;
      newTracker.update(trafficData);try{sessionStorage.setItem('kpmap-traffic-new',JSON.stringify(newTracker.snapshot()));}catch{}
      lastSuccessfulFetch = Date.now();
      showUpdateTime(data.fetchedAt);
      updated.classList.remove('is-stale');
      if (changed) {
        locateEvents(trafficData);
        renderIntervals();
        renderMap();
        dataSignature = signature;
      } else if (refreshBadges()) renderMap();
      updateMapMeta();
      renderList();
    } catch (error) {
      console.error('KPMAP traffic', error);
      meta.textContent = '更新に失敗しました。前回取得した情報を表示しています。';
      if (updated) updated.classList.add('is-stale');
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
  setInterval(() => { if (!document.hidden) load(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastSuccessfulFetch >= 30000) load();
  });
  window.addEventListener('online', load);
  setInterval(()=>{if(!document.hidden&&trafficData.length){if(refreshBadges())renderMap();renderList();}},60000);
  setInterval(() => document.querySelectorAll('.traffic-age[data-occurred-at]').forEach(el => {
    el.textContent = eventAge(el.dataset.occurredAt);
  }), 60000);
})();
