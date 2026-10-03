# Traffic location reference data

`traffic-landmarks.json` is a hidden lookup catalogue. It does not add facility labels.
The 2026-10-03 snapshot contains 741 route-scoped entries, including 278 tunnel entries
(some shared road sections have a lookup entry in more than one route).

## Sources

- OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright
- Geofabrik Chugoku extract, OSM snapshot 2026-10-01:
  https://download.geofabrik.de/asia/japan/chugoku.html
- MLIT road infrastructure inspection facility names (2024), through Q地図:
  https://qchizu.jp/road-structures/
  https://road-structures-map.mlit.go.jp/Index.aspx
  Inspection points identify the name of an OSM tunnel shape. The quantized inspection
  coordinates are not used as map marker positions. MLIT's viewer specifies
  noncommercial use; this snapshot is a noncommercial reference.
- Existing route/facility data, HighwayOrderedDS:
  https://github.com/yH3PO4/HighwayOrderedDS
- Names and lengths of the screenshot tunnels were cross-checked against NEXCO:
  https://corp.w-nexco.co.jp/newly/h25/0611/pdfs/01.pdf

OSM-derived data remains available in the public catalogue under ODbL 1.0.
Preserve source attribution when redistributing the data. `variants[].osmWays`
and `osmNodes` record the relevant source IDs. Catalogue coordinates come from OSM
road geometry or the existing facility dataset; there is no global affine conversion
of iHighway's schematic map pixels.

## Refreshing

The browser uses static local data, not Overpass queries or per-event geocoding.
To rebuild a snapshot, install Python `osmium`, `shapely`, and `mapbox-vector-tile`,
download `chugoku-latest.osm.pbf`, and run the collection scripts from the project root.
The Q地図 tile release in `scripts/download-tunnel-points.py` must be checked when refreshing.
`routes-live.json` can be extracted from a built `dist/index.html`'s `const D` JSON.

```sh
python scripts/extract-traffic-osm.py
python scripts/download-tunnel-points.py
python scripts/build-traffic-landmarks.py osm-landmarks-fast.json tunnel-points.json routes-live.json
npm run build
node tests/traffic-location.test.cjs dist/index.html
```

Tunnel fragments are joined by shared endpoints; opposite carriageways stay separate.
Names are assigned only to nearby tunnel geometry on the same road. Adjacent bores can
be matched using centre proximity and compatible lengths. Unmatched/conflicting
inspection records are excluded. Junctions, named bridges, bus stops connected to highway/service ways (plus 熊谷, matched in live traffic) and
existing IC/JCT/SA/PA entries supplement the lookup. Future additions should be
checked on the same route and must never be assigned a global fallback point.

## Position semantics and regression checks

`付近`, `先`, and `手前` do not reveal the exact incident coordinates. A resolved
facility point is a reference. A resolved interval uses its road-length midpoint;
it is not a claimed accident site. Partial intervals state which endpoint is known.
Unknown positions have no map pin and remain available in a collapsed list with
an explicit unknown-distance label. Data fetching, priorities, 20 km nearby radius,
marker clustering and existing KP/location controls are preserved.

The fixture is an actual 42-event API snapshot from 2026-10-03 and is test-only.
Tests ensure the screenshot's Okayama tunnels are not placed at Numata PA, confirm
both-direction tunnel portals, resolve all snapshot events, handle aliases, and
reject arbitrary fallback positions. Live future events may contain unknown names.
