const SOURCE_URL = 'https://ihighway.jp/datas/json/traffic.json';
const AREA_KEY = 'area07';
const DISPLAY_ROADS = new Set(['山陽道','中国道','広島道','広島岩国道路']);

const CATEGORY_LABELS = {
  closed: '通行止', oneLane: '片側交互通行', laneRestriction: '車線規制',
  underRegulation: '規制中', accident: '事故', broken: '故障車',
  ramp: 'IC・ランプ規制', falling: '落下物', jam: '渋滞',
  snowChain: 'チェーン規制', snowTires: '冬用タイヤ規制',
  snowPlow: '除雪作業', rainCaution: '雨天注意', antifreeze: '凍結防止作業'
};

function collectGroups(bucket, output) {
  for (const [category, roads] of Object.entries(bucket || {})) {
    if (!Array.isArray(roads)) continue;
    for (const road of roads) {
      for (const event of Array.isArray(road?.info) ? road.info : []) {
        if (!event || typeof event !== 'object') continue;
        const title = String(event.title || '').trim();
        if (!title || !DISPLAY_ROADS.has(String(road.roadName || '').trim())) continue;
        const coordinates = Array.isArray(event.coordinate) ? event.coordinate : event.coordinate ? [event.coordinate] : [];
        const points = coordinates.map(c => ({
          x: ((Number(c.startX) || 0) + (Number(c.endX) || Number(c.startX) || 0)) / 2,
          y: ((Number(c.startY) || 0) + (Number(c.endY) || Number(c.startY) || 0)) / 2
        })).filter(c => Number.isFinite(c.x) && Number.isFinite(c.y) && (c.x !== 0 || c.y !== 0));
        const mapX = points.length ? points.reduce((n, c) => n + c.x, 0) / points.length : null;
        const mapY = points.length ? points.reduce((n, c) => n + c.y, 0) / points.length : null;
        output.push({
          road: String(road.roadName || '').trim(),
          category,
          categoryLabel: CATEGORY_LABELS[category] || category,
          title,
          direction: String(event.direction || '').trim(),
          reason: String(event.reason || '').trim(),
          detail: String(event.detail || '').trim(),
          mapX, mapY,
          url: /^https:\/\//.test(event.url || '') ? event.url : ''
        });
      }
    }
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const upstream = await fetch(SOURCE_URL, { cache: 'no-store', headers: { 'User-Agent': 'KPMAP/1.0 traffic display', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) throw new Error('upstream status ' + upstream.status);
    const raw = await upstream.json();
    const area = raw?.[AREA_KEY];
    if (!area || typeof area !== 'object') throw new Error('area07 is missing');
    const events = [];
    collectGroups(area.trafficInfo, events);
    collectGroups(area.otherTrafficInfo, events);
    events.sort((a, b) => a.road.localeCompare(b.road, 'ja') || a.title.localeCompare(b.title, 'ja'));
    return res.status(200).json({ area: '中国地方', source: 'iHighway / JARTIC', fetchedAt: new Date().toISOString(), count: events.length, events });
  } catch (error) {
    return res.status(502).json({ error: '交通情報を取得できませんでした', detail: String(error?.message || error) });
  }
};

