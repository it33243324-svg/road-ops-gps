// Pause decorative animations when their region is outside the screen. Keep
// GPS, traffic polling and notification state independent of rendering.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    html.kpmap-document-hidden *,html.kpmap-document-hidden *::before,
    html.kpmap-document-hidden *::after,.kpmap-render-paused,
    .kpmap-render-paused *,.kpmap-render-paused::before,
    .kpmap-render-paused::after,.kpmap-render-paused *::before,
    .kpmap-render-paused *::after{animation-play-state:paused!important}
    body.kpmap-map-dragging .kpmap-brand span,
    body.kpmap-map-dragging :is(#go,#gmap,.gmap-selected-action),
    body.kpmap-map-dragging :is(#go,#gmap,.gmap-selected-action)::before,
    body.kpmap-map-dragging :is(#go,#gmap,.gmap-selected-action)::after,
    body.kpmap-map-dragging .location-wave,
    body.kpmap-map-dragging .map-fullscreen-shortcut::before,
    body.kpmap-map-dragging .map-fullscreen-shortcut::after{animation-play-state:paused!important}
  `;
  document.head.appendChild(style);
  const endDrag = () => document.body?.classList.remove('kpmap-map-dragging');
  map.on('dragstart', () => document.body?.classList.add('kpmap-map-dragging'));
  map.on('moveend zoomend', endDrag);
  const sync = () => {
    document.documentElement.classList.toggle('kpmap-document-hidden', document.hidden);
    if (document.hidden) endDrag();
  };
  document.addEventListener('visibilitychange', sync); sync();
  let observer = null;
  map.on('unload', () => {observer?.disconnect();endDrag();document.removeEventListener('visibilitychange', sync);});
  // Old browsers retain the normal effects rather than hiding information.
  if (!window.IntersectionObserver) return;
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('kpmap-render-paused', !entry.isIntersecting);
  }, {rootMargin:'100px'});
  for (const node of document.querySelectorAll('#m,.kpmap-brand-header,.kpmap-toolbar')) observer.observe(node);
})();
