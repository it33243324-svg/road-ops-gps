// Leaflet 1.9.4 Canvas.onAdd invokes Renderer.onAdd without a map argument.
// leaflet-rotate 0.3.0 expects that argument; use the already assigned layer map.
(() => {
  const add = L.Renderer.prototype.onAdd;
  L.Renderer.prototype.onAdd = function (map) { return add.call(this, map || this._map); };
})();
