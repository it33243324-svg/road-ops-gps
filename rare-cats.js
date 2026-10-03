(() => {
  'use strict';
  const hour = 60 * 60 * 1000;
  const openedAt = Date.now();
  const host = document.getElementById('m');
  if (!host) return;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const colors = ['#f5c64c', '#eee8dc', '#df8c47', '#899baa', '#efb6b9'];
  // Small original helmet-cat drawings: five different coats, expressions and tools.
  function cat(index) {
    const coats = ['#a7aaa8','#e9dbc3','#df9d66','#778592','#e8e6de'];
    const tool = [
      '<path d="M45 38l9-7m-2-2 5 4"/>',
      '<rect x="42" y="37" width="14" height="14" rx="1" fill="#bd9568"/>',
      '<path d="M48 48V26"/><path d="M48 26h12l-3 8H48" fill="#ec655e"/>',
      '<rect x="42" y="32" width="13" height="18" rx="2" fill="#fff"/><path d="M45 37h7m-7 4h7"/>',
      '<path d="M43 50l7-19 7 19z" fill="#f79e46"/><path d="M47 40h7" stroke="#fff"/>'
    ][index];
    const eyes = index === 1 ? '<path d="M19 24l4-2m8 0 4 2"/>' : '<path d="M20 22v3m13-3v3"/>';
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#344653" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 46q-12 5-9-7" fill="none"/><path d="M18 33q-4 9-1 18l-3 7h10l3-8 4 8h10l-6-9q2-9-2-16" fill="'+coats[index]+'"/><path d="M14 18l1-10 10 5h7l9-6 1 14q0 14-14 14T14 18" fill="'+coats[index]+'"/>'+eyes+'<path d="M25 27l3 2 3-2m-9 4q6 4 12 0" fill="none"/><path d="M11 18q0-14 17-14t17 14z" fill="'+colors[index]+'"/><path d="M10 18h36M28 5v8"/><path d="M19 38l-6 5m21-5 10 4" fill="none"/>'+tool+'</g></svg>';
  }
  const style = document.createElement('style');
  style.textContent = '.kpmap-rare-cats,.kpmap-rare-cats *{pointer-events:none!important;user-select:none!important}.kpmap-rare-cats{position:absolute;inset:0;overflow:hidden;z-index:810}.kpmap-rare-cat{position:absolute;left:-68px;bottom:100px;width:48px;height:48px;opacity:.88;animation:kpmap-cat-cross 12s linear both;animation-delay:var(--delay)}.kpmap-rare-cat svg{width:100%;height:100%;animation:kpmap-cat-step .45s ease-in-out infinite alternate}@keyframes kpmap-cat-cross{to{left:calc(100% + 68px)}}@keyframes kpmap-cat-step{to{transform:translateY(-3px) rotate(3deg)}}@media(max-width:600px){.kpmap-rare-cat{width:40px;height:40px;bottom:90px}}@media(prefers-reduced-motion:reduce){.kpmap-rare-cats{display:none}}';
  document.head.appendChild(style);
  let active = null;
  let cleanupTimer = null;
  function clear() {
    active?.remove(); active = null;
    clearTimeout(cleanupTimer); cleanupTimer = null;
  }
  function show() {
    if (document.hidden || motion?.matches || active) return;
    active = document.createElement('div');
    active.className = 'kpmap-rare-cats';
    active.setAttribute('aria-hidden', 'true');
    const order = [0,1,2,3,4].sort(() => Math.random() - .5);
    active.innerHTML = order.map((index,i)=>'<span class="kpmap-rare-cat" style="--delay:'+i*.8+'s">'+cat(index)+'</span>').join('');
    host.appendChild(active);
    cleanupTimer = setTimeout(clear, 16000);
  }
  // Exactly one randomly selected instant in each hour measured from page open.
  // Hidden occurrences are skipped, never accumulated for a return to the tab.
  function schedule(bucket) {
    const due = openedAt + bucket * hour + Math.random() * hour;
    setTimeout(() => {
      show();
      schedule(Math.max(bucket + 1, Math.floor((Date.now() - openedAt) / hour) + 1));
    }, Math.max(0, due - Date.now()));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  motion?.addEventListener?.('change', () => { if (motion.matches) clear(); });
  schedule(0);
})();
