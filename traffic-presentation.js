(function(root) {
  'use strict';
  const distanceKm = (a, b) => {
    const rad = n => n * Math.PI / 180;
    const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  function isRegulation(e) {
    if (['closed', 'accident', 'broken', 'falling'].includes(e.category)) return false;
    return ['oneLane', 'laneRestriction', 'underRegulation', 'snowChain', 'snowTires', 'snowPlow', 'antifreeze'].includes(e.category) || /工事|作業|車線規制|交通規制/.test(e.reason || '');
  }
  function mapRank(e) {
    if (e.category === 'closed') return 0;
    if (e.category === 'accident') return 1;
    if (e.category === 'broken') return 2;
    if (e.category === 'falling') return 3;
    return isRegulation(e) ? 5 : 4;
  }
  function nearbyGroups(events, location, radius) {
    const near = events.filter(e => e.mapPoint && distanceKm(location, e.mapPoint) <= radius)
      .map(e => ({ event: e, distance: distanceKm(location, e.mapPoint) }))
      .sort((a, b) => a.distance - b.distance);
    return { priority: near.filter(x => !isRegulation(x.event)), regulation: near.filter(x => isRegulation(x.event)), count: near.length };
  }
  function eventAge(timestamp, now = Date.now()) {
    // Only actual, absolute occurrence timestamps qualify. Fetch/first-seen time is never used.
    if (typeof timestamp !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return '';
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time) || time > now + 60000) return '';
    const minutes = Math.max(0, Math.floor((now - time) / 60000));
    return minutes < 1 ? '発生から1分未満' : '発生から' + minutes + '分';
  }
  const api = { distanceKm, isRegulation, mapRank, nearbyGroups, eventAge };
  root.KPMAPTrafficPresentation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
