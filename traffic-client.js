(() => {
  const list = document.getElementById('trafficList');
  const count = document.getElementById('trafficCount');
  const meta = document.getElementById('trafficMeta');
  const refresh = document.getElementById('trafficRefresh');
  let busy = false;

  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const formatTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  function render(data) {
    const events = Array.isArray(data.events) ? data.events : [];
    count.textContent = events.length + '件';
    meta.textContent = (data.source || 'iHighway / JARTIC') + ' ・ 取得 ' + formatTime(data.fetchedAt) + ' ・ 5分ごとに更新';
    meta.classList.remove('traffic-error');
    list.dataset.loaded = 'true';
    list.innerHTML = events.length ? events.map(event =>
      '<article class="traffic-card" data-type="' + escapeHtml(event.category) + '">' +
      '<div class="traffic-loc">' + escapeHtml(event.road) + '　' + escapeHtml(event.title) + '</div>' +
      '<div class="traffic-tags">' +
      [event.categoryLabel, event.direction, event.reason, event.detail].filter(Boolean)
        .map(tag => '<span class="traffic-tag">' + escapeHtml(tag) + '</span>').join('') +
      '</div></article>'
    ).join('') : '<div class="traffic-empty">現在、表示できる交通規制情報はありません。</div>';
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
      render(data);
    } catch {
      meta.textContent = '情報取得に失敗しました。しばらくしてから再試行してください。';
      meta.classList.add('traffic-error');
      if (!list.dataset.loaded) list.innerHTML = '<div class="traffic-empty">交通情報を取得できませんでした。</div>';
    } finally {
      busy = false;
      refresh.disabled = false;
      refresh.textContent = '更新';
    }
  }

  refresh.addEventListener('click', load);
  load();
  setInterval(load, 300000);
})();
