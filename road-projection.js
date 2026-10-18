// Share exact projected geometry between the road's casing/color/selection
// strokes. Keep Leaflet's clipping, simplification and per-stroke bounds intact.
(() => {
  const states = new WeakMap();
  const base = L.Polyline.prototype;
  const Road = L.Polyline.extend({
    initialize(points, options) {
      this._kpmapProjectionKey = points;
      base.initialize.call(this, points, options);
    },
    setLatLngs(points) {
      // Public geometry edits isolate this stroke from previously shared data.
      this._kpmapProjectionKey = {};
      return base.setLatLngs.call(this, points);
    },
    addLatLng(point, ring) {
      this._kpmapProjectionKey = {};
      return base.addLatLng.call(this, point, ring);
    },
    _project() {
      const map = this._map, origin = map.getPixelOrigin(), zoom = map.getZoom();
      let state = states.get(map);
      if (!state || state.zoom !== zoom || state.x !== origin.x || state.y !== origin.y) {
        state = {zoom, x: origin.x, y: origin.y, paths: new WeakMap()};
        states.set(map, state);
      }
      const cached = state.paths.get(this._kpmapProjectionKey);
      if (cached) {
        // An independent outer array also keeps noClip/simplification changes
        // on one stroke from replacing the ring arrays of another stroke.
        this._rings = cached.rings.slice();
        this._rawPxBounds = cached.bounds;
        this._updateBounds();
      } else {
        base._project.call(this);
        state.paths.set(this._kpmapProjectionKey, {
          rings: this._rings.slice(), bounds: this._rawPxBounds
        });
      }
    }
  });
  window.KPMAPRoadPolyline = (points, options) => new Road(points, options);
})();
