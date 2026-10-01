(() => {
  let watchId = null;
  let latest = null;
  let previousSample = null;
  let lastMotionHeading = null;
  let lastHeadingSource = null;
  let vehicleEvidence = 0;
  let firstFix = true;

  const MIN_VEHICLE_SPEED = 7; // m/s ≈ 25 km/h
  const MIN_TRACK_SPEED = 8; // m/s ≈ 29 km/h

  const finite = value => Number.isFinite(value);
  const rad = value => value * Math.PI / 180;
  const distanceMeters = (a, b) => {
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(h));
  };
  const bearing = (a, b) => (Math.atan2(
    Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])),
    Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]))
  ) * 180 / Math.PI + 360) % 360;

  function showPosition(position, recenter = false) {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const point = [latitude, longitude];
    let vehicleCandidate = false;
    let candidateHeading = null;
    let candidateSource = null;
    if (previousSample) {
      const elapsed = (position.timestamp - previousSample.time) / 1000;
      const goodAccuracy = finite(accuracy) && accuracy <= 35;
      const moved = distanceMeters(previousSample.point, point);
      const gpsSpeedConfirmsVehicle = goodAccuracy && finite(speed) && speed >= MIN_VEHICLE_SPEED;

      if (gpsSpeedConfirmsVehicle) {
        vehicleCandidate = true;
        if (finite(heading) && heading >= 0) {
          candidateHeading = heading;
          candidateSource = 'vehicle-gps';
        } else if (elapsed >= 1 && elapsed <= 10 && moved >= 5) {
          candidateHeading = bearing(previousSample.point, point);
          candidateSource = 'vehicle-track';
        }
      } else if (goodAccuracy && accuracy <= 25 && elapsed >= 1 && elapsed <= 10 &&
                 moved / elapsed >= MIN_TRACK_SPEED && moved <= elapsed * 45) {
        // Some devices omit coords.speed; infer vehicle movement only from
        // sustained, accurate GPS fixes at highway-like speeds.
        vehicleCandidate = true;
        candidateHeading = bearing(previousSample.point, point);
        candidateSource = 'vehicle-track';
      }
    }

    if (vehicleCandidate && finite(candidateHeading)) {
      vehicleEvidence += 1;
      if (vehicleEvidence >= 2) {
        lastMotionHeading = candidateHeading;
        lastHeadingSource = candidateSource;
      }
    } else {
      vehicleEvidence = 0;
    }
    previousSample = { point, time: position.timestamp };
    latest = { point, accuracy, speed };

    if (!map.getPane('locationPane')) {
      map.createPane('locationPane');
      map.getPane('locationPane').style.zIndex = '700';
    }
    here.clearLayers();
    const arrow = finite(lastMotionHeading) ? lastMotionHeading : 0;
    const icon = L.divIcon({
      className: '', iconSize: [52, 52], iconAnchor: [26, 26],
      html: '<div style="width:52px;height:52px;position:relative;"><span class="location-wave"></span><span class="location-wave second"></span></div><div style="width:52px;height:52px;position:absolute;left:0;top:0;filter:drop-shadow(0 2px 4px #00101888);transform:rotate(' + arrow + 'deg)"><div style="position:absolute;left:20px;top:0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:20px solid #ff304f"></div><div style="position:absolute;left:10px;top:10px;width:32px;height:32px;box-sizing:border-box;border-radius:50%;background:#ff304f;border:4px solid white;box-shadow:0 0 0 2px #ff304f55"></div></div>'
    });
    L.marker(point, { icon, pane: 'locationPane', zIndexOffset: 10000 }).addTo(here);
    if (finite(accuracy)) L.circle(point, { radius: accuracy, color: '#ff304f', weight: 2, fillColor: '#ff304f', fillOpacity: .08, interactive: false }).addTo(here);

    if (firstFix) setDefaultView(point);
    else if (recenter) map.setView(point, map.getZoom());
    firstFix = false;
    const headingSource = finite(lastMotionHeading) ? lastHeadingSource : null;
    window.dispatchEvent(new CustomEvent('kpmap-location', { detail: {
      lat: latitude, lng: longitude, heading: lastMotionHeading, headingSource,
      speed, accuracy
    }}));
    loc.disabled = false;
    loc.textContent = '現在地';
    msg.textContent = '現在地を表示しました（精度 約' + Math.round(accuracy || 0) + 'm' +
      (finite(lastMotionHeading) ? '・車両走行時の方向を保持' : '・車両走行を確認中') + '）';
    labels();
  }

  function onError(error) {
    if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
    watchId = null;
    loc.disabled = false;
    loc.textContent = '現在地';
    const message = error.code === 1 ? '位置情報の使用が許可されていません' : '現在地を取得できません';
    msg.textContent = message;
    window.dispatchEvent(new CustomEvent('kpmap-location-error', { detail: { message } }));
  }

  function requestLocation(recenter = false) {
    if (!navigator.geolocation) {
      onError({ code: 2 });
      return;
    }
    if (latest && recenter) {
      map.setView(latest.point, map.getZoom());
      return;
    }
    if (watchId !== null) return;
    loc.disabled = true;
    loc.textContent = '取得中…';
    watchId = navigator.geolocation.watchPosition(
      position => showPosition(position), onError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  loc.onclick = () => requestLocation(true);
  const recenterControl = L.control({ position: 'topleft' });
  recenterControl.onAdd = () => {
    const button = L.DomUtil.create('button', 'map-recenter');
    button.type = 'button';
    button.title = '現在地に戻る';
    button.setAttribute('aria-label', '現在地に戻る');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v3m0 14v3M2 12h3m14 0h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.disableScrollPropagation(button);
    button.onclick = () => requestLocation(true);
    return button;
  };
  recenterControl.addTo(map);
  requestLocation(false);
})();
