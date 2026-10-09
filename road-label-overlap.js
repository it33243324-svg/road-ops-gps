// Reveal only road strokes covered by map labels and incident icons.
(() => {
  const container = map.getContainer();
  const canvas = document.createElement('canvas');
  canvas.className = 'kpmap-road-label-overlap';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%',
    height: '100%', zIndex: '900', pointerEvents: 'none' });
  container.appendChild(canvas);
  const buffer = document.createElement('canvas');
  const ctx = canvas.getContext('2d'), ink = buffer.getContext('2d');
  if (!ctx || !ink) { canvas.remove(); return; }
  const labelSelector = '.kplabel,.facility .fname,.facility .dot,.detail-label,' +
    '.traffic-event-marker,.traffic-cluster-count,.traffic-map-new';
  let frame = 0, moving = false, geometryDirty = true, projected = [];

  function projectRoads() {
    const colors = new Set(Object.values(D).map(route => route.color));
    projected = [];
    // Paint selected strokes last into an opaque buffer, avoiding double alpha
    // where the selected and ordinary road layers cover the same geometry.
    for (const group of [roads, sel]) group.eachLayer(line => {
      if (!line.getLatLngs || !colors.has(line.options.color)) return;
      function part(points) {
        if (!points.length) return;
        if (Array.isArray(points[0])) { points.forEach(part); return; }
        projected.push({ color: line.options.color, weight: line.options.weight,
          points: points.map(point => map.latLngToContainerPoint(point)) });
      }
      part(line.getLatLngs());
    });
    geometryDirty = false;
  }

  function draw() {
    frame = 0;
    if (moving) return;
    const size = map.getSize(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!size.x || !size.y) return;
    const width = Math.round(size.x * dpr), height = Math.round(size.y * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = buffer.width = width; canvas.height = buffer.height = height;
      geometryDirty = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const bounds = container.getBoundingClientRect();
    // Account for CSS scaling of the map container as well as display density.
    const sx = bounds.width ? size.x / bounds.width : 1;
    const sy = bounds.height ? size.y / bounds.height : 1;
    const rectangles = Array.from(container.querySelectorAll(labelSelector))
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.width && rect.height && rect.right > bounds.left &&
        rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom);
    if (!rectangles.length) return;
    if (geometryDirty) projectRoads();
    ink.setTransform(1, 0, 0, 1, 0, 0);
    ink.clearRect(0, 0, width, height);
    ink.setTransform(dpr, 0, 0, dpr, 0, 0);
    ink.lineCap = ink.lineJoin = 'round';
    for (const line of projected) {
      ink.strokeStyle = line.color; ink.lineWidth = line.weight;
      ink.beginPath();
      line.points.forEach((point, index) => {
        if (index === 0) ink.moveTo(point.x, point.y);
        else ink.lineTo(point.x, point.y);
      });
      ink.stroke();
    }
    ctx.save();
    ctx.beginPath();
    // One union clip and one composite keep transparency at exactly 70%,
    // including where several labels or road layers overlap one another.
    for (const rect of rectangles) ctx.rect((rect.left - bounds.left) * sx * dpr,
      (rect.top - bounds.top) * sy * dpr, rect.width * sx * dpr, rect.height * sy * dpr);
    ctx.clip(); ctx.globalAlpha = .3;
    ctx.drawImage(buffer, 0, 0);
    ctx.restore();
  }
  function schedule() { if (!frame && !moving) frame = requestAnimationFrame(draw); }
  map.on('movestart zoomstart', () => { moving = true; canvas.hidden = true; });
  map.on('moveend zoomend resize rotate', () => {
    moving = false; canvas.hidden = false; geometryDirty = true; schedule();
  });
  for (const group of [roads, sel]) group.on('layeradd layerremove', () => {
    geometryDirty = true; schedule();
  });
  const observer = new MutationObserver(records => {
    if (records.some(record => record.target !== canvas)) schedule();
  });
  observer.observe(container, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['style', 'class'] });
  // Existing scripts apply zoom-dependent stroke widths in the same event turn.
  r.addEventListener('change', () => { geometryDirty = true; schedule(); });
  map.on('unload', () => {
    observer.disconnect(); if (frame) cancelAnimationFrame(frame); canvas.remove();
  });
  schedule();
})();
