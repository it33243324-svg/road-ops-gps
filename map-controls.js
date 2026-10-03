(() => {
  const container = map.getContainer();
  let following = false, headingUp = false, latest = null, fullscreenFallback = false;
  let savedFocus = null;
  const controls = L.control({ position: 'topleft' });
  const svg = path => '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  const expand = '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  const shrink = '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  const followIcon = '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="3 2"/><path d="m12 5 5 13-5-3-5 3z" fill="currentColor"/>';
  const compassIcon = '<path d="m12 3 5 15-5-3-5 3z" fill="currentColor"/>';
  let fullButton, followButton, headingButton, status;
  const pressed = (button, on) => {
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-pressed', String(on));
  };
  function syncState() {
    pressed(followButton, following);
    pressed(headingButton, headingUp);
    followButton.title = following ? '現在地の追従をOFFにする' : '現在地を追いかける';
    followButton.setAttribute('aria-label', followButton.title);
    followButton.querySelector('span').textContent = following ? '追従中' : '追従';
    headingButton.title = headingUp ? '北を上に戻す' : '車の進行方向を上にする';
    headingButton.setAttribute('aria-label', headingButton.title);
    headingButton.querySelector('span').textContent = headingUp ? '進行↑' : '北↑';
    const recentHeading = latest && latest.directionStatus !== 'judging' && Number.isFinite(latest.heading) && Number.isFinite(latest.headingTimestamp) && Date.now() - latest.headingTimestamp <= 60000;
    const directionMessage = latest?.directionStatus === 'judging' ? '追従中・進行方向は判定中（40km/h以上・30秒）' : '追従中・進行方向は取得できません';
    status.textContent = following ? !latest ? '現在地を取得中' : headingUp ? recentHeading ? '進行方向を上にして追従中' : directionMessage : '現在地に追従中' : '';
    status.hidden = !following;
  }
  function applyView() {
    if (!following || !latest) return;
    if (Date.now() - latest.timestamp > 30000) return;
    map.panTo(latest.point, { animate: false });
    if (headingUp && Number.isFinite(latest.heading) && Number.isFinite(latest.headingTimestamp) && Date.now() - latest.headingTimestamp <= 60000) {
      map.setHeading(latest.heading, { ease: .16, deadzone: 1.5 });
    }
  }
  function pauseFollow() {
    following = false;
    map.stopHeadingUp?.();
    syncState();
  }
  function resetNorth() {
    headingUp = false;
    map.stopHeadingUp?.();
    map.setBearing?.(0);
    syncState();
  }
  function isFullscreen() { return document.fullscreenElement === container || fullscreenFallback; }
  function resizeMap() {
    requestAnimationFrame(() => map.invalidateSize({ animate: false, debounceMoveend: true }));
  }
  function syncFullscreen() {
    const on = isFullscreen();
    container.classList.toggle('map-fullscreen', on);
    document.body.classList.toggle('kpmap-fullscreen-open', on);
    fullButton.innerHTML = svg(on ? shrink : expand) + '<span>' + (on ? '戻す' : '全画面') + '</span>';
    fullButton.title = on ? '全画面を終了する' : '地図を全画面にする';
    fullButton.setAttribute('aria-label', fullButton.title);
    pressed(fullButton, on);
    resizeMap();
    if (!on && savedFocus) { savedFocus.focus?.(); savedFocus = null; }
  }
  async function toggleFullscreen() {
    if (isFullscreen()) {
      if (document.fullscreenElement === container) await document.exitFullscreen();
      else { fullscreenFallback = false; syncFullscreen(); }
      return;
    }
    savedFocus = document.activeElement;
    if (container.requestFullscreen && document.fullscreenEnabled) {
      try { await container.requestFullscreen(); syncFullscreen(); return; } catch (_) { /* Mobile browsers can deny native fullscreen. */ }
    }
    fullscreenFallback = true;
    syncFullscreen();
  }
  controls.onAdd = () => {
    const group = L.DomUtil.create('div', 'map-tools');
    const button = (name, icon, label, handler) => {
      const el = L.DomUtil.create('button', 'map-tool', group);
      el.type = 'button'; el.title = name; el.setAttribute('aria-label', name); el.setAttribute('aria-pressed', 'false');
      el.innerHTML = svg(icon) + '<span>' + label + '</span>';
      el.onclick = handler;
      return el;
    };
    fullButton = button('地図を全画面にする', expand, '全画面', toggleFullscreen);
    fullButton.setAttribute('aria-keyshortcuts', 'F');
    const shortcutHint = L.DomUtil.create('span', 'map-fullscreen-shortcut', group);
    shortcutHint.textContent = 'F';
    shortcutHint.setAttribute('aria-hidden', 'true');
    followButton = button('現在地を追いかける', followIcon, '追従', () => {
      following = !following;
      syncState();
      if (following) { KPMAPLocation.request(true); applyView(); }
      else map.stopHeadingUp?.();
    });
    headingButton = button('車の進行方向を上にする', compassIcon, '北↑', () => {
      if (headingUp) resetNorth();
      else {
        headingUp = true; following = true;
        syncState(); KPMAPLocation.request(true); applyView();
      }
    });
    L.DomEvent.disableClickPropagation(group);
    L.DomEvent.disableScrollPropagation(group);
    return group;
  };
  controls.addTo(map);
  status = L.DomUtil.create('div', 'map-tracking-status', container);
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  window.addEventListener('kpmap-location', e => {
    latest = { ...e.detail, point: [e.detail.lat, e.detail.lng] };
    applyView(); syncState();
  });
  window.addEventListener('kpmap-location-error', e => {
    if (following) { status.hidden = false; status.textContent = e.detail.message; }
  });
  // User exploration always wins over automatic recentering.
  map.on('dragstart', pauseFollow);
  window.addEventListener('kpmap-browse-map', pauseFollow);
  go.addEventListener('click', pauseFollow);
  q.addEventListener('input', pauseFollow);
  r.addEventListener('change', pauseFollow);
  document.querySelectorAll('.chip').forEach(el => el.addEventListener('click', pauseFollow));
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('keydown', e => {
    const editing = e.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    if (e.key?.toLowerCase() === 'f' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !editing) {
      e.preventDefault(); toggleFullscreen(); return;
    }
    if (e.key === 'Escape' && fullscreenFallback) { fullscreenFallback = false; syncFullscreen(); }
  });
  let rotateLabels = 0;
  map.on('rotate', () => {
    clearTimeout(rotateLabels);
    rotateLabels = setTimeout(labels, 180);
  });
  const last = KPMAPLocation.getLatest();
  if (last) latest = last;
  syncState();

  // Keep the existing Google Map action available while only the map is fullscreen.
  const fullAction = L.control({ position: 'topleft' });
  let fullGoogle, selectedLabel;
  function syncSelected() {
    fullGoogle.disabled = gmap.disabled;
    fullGoogle.classList.toggle('gmap-selected-action', !gmap.disabled);
    selectedLabel.textContent = typeof pickedKp !== 'undefined' && pickedKp ? pickedKp[2].toFixed(1) + ' KP 選択中' : 'KPを選択してください';
  }
  fullAction.onAdd = () => {
    const panel = L.DomUtil.create('div', 'map-fullscreen-action');
    selectedLabel = L.DomUtil.create('span', '', panel);
    fullGoogle = L.DomUtil.create('button', 'map-fullscreen-google', panel);
    fullGoogle.type = 'button'; fullGoogle.textContent = 'Google Map';
    fullGoogle.onclick = () => gmap.click();
    L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel);
    return panel;
  };
  fullAction.addTo(map);
  new MutationObserver(syncSelected).observe(gmap, { attributes: true, attributeFilter: ['disabled'] });
  map.on('click', () => requestAnimationFrame(syncSelected));
  q.addEventListener('input', () => requestAnimationFrame(syncSelected));
  r.addEventListener('change', () => requestAnimationFrame(syncSelected));
  syncSelected();
})();
