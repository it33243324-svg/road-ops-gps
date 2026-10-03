(() => {
  'use strict';
  const hour = 60 * 60 * 1000;
  const openedAt = Date.now();
  const host = document.getElementById('m');
  if (!host) return;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const style = document.createElement('style');
  style.textContent = '.kpmap-rare-cats,.kpmap-rare-cats *{pointer-events:none!important;user-select:none!important}.kpmap-rare-cats{position:absolute;inset:0;overflow:hidden;z-index:810}.kpmap-rare-cat{position:absolute;left:calc(-1 * var(--cat-size));top:50%;transform:translateY(-50%);width:var(--cat-size);height:var(--cat-size);animation:kpmap-cat-cross var(--travel) linear both;animation-delay:var(--delay)}.kpmap-rare-cat img{display:block;width:100%;height:100%;object-fit:contain}.kpmap-rare-cat.is-flipped img{transform:scaleX(-1)}@keyframes kpmap-cat-cross{to{left:calc(100% + var(--cat-size))}}@media(prefers-reduced-motion:reduce){.kpmap-rare-cats{display:none}}';
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
    const size = window.innerWidth <= 600 ? 76 : 96;
    const duration = (host.clientWidth + size * 2) / 180;
    const interval = (size + 8) / 180;
    active.style.setProperty('--cat-size', size + 'px');
    active.style.setProperty('--travel', duration + 's');
    active.innerHTML = Array.from({length:5},(_,i)=>'<span class="kpmap-rare-cat'+(i===1||i===3?' is-flipped':'')+'" style="--delay:'+i*interval+'s"><img src="assets/genba-cat.gif" alt="" draggable="false" decoding="async"></span>').join('');
    host.appendChild(active);
    cleanupTimer = setTimeout(clear, Math.ceil((duration + interval * 4) * 1000) + 500);
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
  if (new URLSearchParams(window.location.search).get('catPreview') === '1') {
    show();
    clearTimeout(cleanupTimer);
    const previewSize = window.innerWidth <= 600 ? 76 : 96;
    const previewStart = Math.max(0, (host.clientWidth - (previewSize * 5 + 8 * 4)) / 2);
    if (active) [...active.children].forEach((el,i)=>{
      el.style.animation = 'none';
      el.style.left = (previewStart + i * (previewSize + 8)) + 'px';

    });
  }
  schedule(0);
})();
