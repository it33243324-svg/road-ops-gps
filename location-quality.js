(function(root) {
  'use strict';
  const rad = n => n * Math.PI / 180;
  const distanceMeters = (a, b) => {
    const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  function chooseFix(position, previous, now = Date.now()) {
    const c = position?.coords, time = position?.timestamp;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180 ||
        !Number.isFinite(c.accuracy) || c.accuracy < 0 || !Number.isFinite(time) || now - time > 30000 || time > now + 5000) return null;
    if (previous && time <= previous.time) return null;
    const point = [c.latitude, c.longitude];
    if (previous) {
      const seconds = (time - previous.time) / 1000;
      const moved = distanceMeters(previous.point, point);
      if (seconds <= 15 && c.accuracy > Math.max(100, previous.accuracy * 4)) return null;
      if (seconds <= 30 && moved > seconds * 70 + Math.max(c.accuracy, previous.accuracy) * 2) return null;
      // Dampen only tiny stationary/walking jitter; never shift a moving vehicle onto a road.
      if (seconds <= 10 && !(Number.isFinite(c.speed) && c.speed >= 3) && moved < Math.min(10, c.accuracy * .35, previous.accuracy * .35)) {
        return { timestamp: time, coords: { latitude: previous.point[0], longitude: previous.point[1], accuracy: c.accuracy, heading: c.heading, speed: c.speed } };
      }
    }
    return { timestamp: time, coords: { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy, heading: c.heading, speed: c.speed } };
  }
  const api = { chooseFix, distanceMeters };
  root.KPMAPLocationQuality = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
