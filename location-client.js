(() => {
  const roadEl = document.getElementById('locationRoad');
  const directionEl = document.getElementById('locationDirection');
  const kpEl = document.getElementById('locationKp');
  const statusEl = document.getElementById('locationStatus');
  const noteEl = document.getElementById('locationNote');
  const routesData = typeof D !== 'undefined' ? D : {};
  const routeKeys = ['sanyo', 'chugoku', 'hiroshima', 'hiroshima_iwakuni'];
  const directionRules = { sanyo: 'down', chugoku: 'down', hiroshima: 'down', hiroshima_iwakuni: 'down' };

  function distanceKm(a, b) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  function nearestOnRoute(route, point) {
    let best = null;
    const cos = Math.cos(point[0] * Math.PI / 180);
    for (const line of route.segs || []) for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const ax = (a[1] - point[1]) * cos, ay = a[0] - point[0];
      const bx = (b[1] - point[1]) * cos, by = b[0] - point[0];
      const dx = bx - ax, dy = by - ay, den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
      const ll = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const distance = distanceKm(point, ll);
      if (!best || distance < best.distance) best = { point: ll, distance };
    }
    return best;
  }

  function nearestKp(route, point) {
    let best = null;
    for (const mark of route.marks || []) {
      const distance = distanceKm(point, [mark[1], mark[2]]);
      if (!best || distance < best.distance) best = { value: mark[0], distance };
    }
    return best;
  }

  function bearing(a, b) {
    const rad = n => n * Math.PI / 180;
    return (Math.atan2(
      Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])),
      Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]))
    ) * 180 / Math.PI + 360) % 360;
  }

  function increasingKpBearing(route, point) {
    const marks = (route.marks || []).slice().sort((a, b) => a[0] - b[0]);
    if (marks.length < 2) return null;
    let nearestIndex = 0, nearestDistance = Infinity;
    marks.forEach((mark, index) => {
      const d = distanceKm(point, [mark[1], mark[2]]);
      if (d < nearestDistance) { nearestDistance = d; nearestIndex = index; }
    });
    const lower = marks[Math.max(0, nearestIndex - 1)];
    const upper = marks[Math.min(marks.length - 1, nearestIndex + 1)];
    return lower === upper ? null : bearing([lower[1], lower[2]], [upper[1], upper[2]]);
  }

  function getTravelDirection(routeKey, route, point, heading, detailHeadingSource) {
    if (!Number.isFinite(heading)) return { text: '取得できません', note: '40km/h以上で30秒以上の走行をGPSで確認すると判定します。歩行中のGPSは判定に使いません。' };
    if (!(routeKey in directionRules)) return { text: '判定対象外', note: 'この路線は上り・下りの自動判定に対応していません。' };
    const routeBearing = increasingKpBearing(route, point);
    if (!Number.isFinite(routeBearing)) return { text: '判定できません', note: '道路の方向を確認できませんでした。' };
    const delta = Math.abs(((heading - routeBearing + 540) % 360) - 180);
    if (Math.abs(delta - 90) < 35) return { text: '判定できません', note: 'GPSの進行方向が道路の向きと合わないため、方向を判定できませんでした。' };
    const increasing = delta < 90;
    const sourceNote = detailHeadingSource === 'vehicle-track'
      ? '車両走行速度とGPS軌跡から推定しました。'
      : '車両走行中のGPS進行方向から判定しました。';
    return { text: increasing === (directionRules[routeKey] === 'down') ? '下り' : '上り', note: sourceNote + '歩行中のGPSは判定に使いません。道路上の参考表示です.' };
  }

  function locate(detail) {
    const point = [Number(detail.lat), Number(detail.lng)];
    const routes = routeKeys.map(key => ({ key, route: routesData[key], closest: routesData[key] && nearestOnRoute(routesData[key], point) }))
      .filter(item => item.route && item.closest).sort((a, b) => a.closest.distance - b.closest.distance);
    if (!routes.length) {
      roadEl.textContent = '道路データがありません'; directionEl.textContent = '—'; kpEl.textContent = '—';
      statusEl.textContent = '未対応'; noteEl.textContent = 'この地域の高速道路データが見つかりませんでした。'; statusEl.classList.remove('ready'); return;
    }
    const selected = document.getElementById('r')?.value;
    const closestDistance = routes[0].closest.distance;
    const preferred = routes.find(item => item.key === selected && item.closest.distance <= closestDistance + 0.2);
    const match = preferred || routes[0];
    if (closestDistance > 5) {
      roadEl.textContent = '対象の高速道路が近くにありません'; directionEl.textContent = '—'; kpEl.textContent = '—';
      statusEl.textContent = '範囲外'; noteEl.textContent = '対象路線から約' + (Math.round(closestDistance * 10) / 10) + 'km離れています。'; statusEl.classList.remove('ready'); return;
    }
    const roadPoint = match.closest.point || point;
    const nearest = nearestKp(match.route, roadPoint);
    const direction = detail.directionStatus === 'judging' ? { text: '判定中', note: '40km/h以上の走行を30秒間確認しています。' } : getTravelDirection(match.key, match.route, roadPoint, Number.isFinite(detail.heading) ? detail.heading : NaN, detail.headingSource);
    roadEl.textContent = match.route.name + (match.route.code ? ' ' + match.route.code : '');
    directionEl.textContent = direction.text;
    kpEl.textContent = nearest ? Number(nearest.value).toFixed(1) + ' KP' : '—';
    statusEl.textContent = '現在地を取得'; statusEl.classList.add('ready');
    const accuracy = Number.isFinite(detail.accuracy) ? 'GPS精度 約' + Math.round(detail.accuracy) + 'm' : '';
    const roadDistance = match.closest.distance > 0.1 ? '道路まで約' + Math.round(match.closest.distance * 1000) + 'm' : '道路付近';
    noteEl.textContent = [direction.note, roadDistance, accuracy].filter(Boolean).join(' ・ ');
  }

  window.addEventListener('kpmap-location', event => locate(event.detail || {}));
  window.addEventListener('kpmap-location-error', event => {
    roadEl.textContent = '位置情報を許可すると表示します';
    directionEl.textContent = '取得できません'; kpEl.textContent = '—';
    statusEl.textContent = '未取得'; statusEl.classList.remove('ready');
    noteEl.textContent = event.detail?.message || '現在地を取得できませんでした。';
  });
})();

