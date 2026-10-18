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
  `;
  document.head.appendChild(style);
  const sync = () => document.documentElement.classList.toggle('kpmap-document-hidden', document.hidden);
  document.addEventListener('visibilitychange', sync); sync();
  // Old browsers retain the normal effects rather than hiding information.
  if (!window.IntersectionObserver) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('kpmap-render-paused', !entry.isIntersecting);
  }, {rootMargin:'100px'});
  for (const node of document.querySelectorAll('#m,.kpmap-brand-header,.kpmap-toolbar')) observer.observe(node);
  map.on('unload', () => {observer.disconnect();document.removeEventListener('visibilitychange', sync);});
})();
