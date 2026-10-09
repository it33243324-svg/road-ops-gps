# KP stationing calibration

`kp-ledger-anchors.json` records 14 bridge-end references from MLIT highway
road ledgers and the matching upper-carriageway OSM geometry dated 2026-10-08.
PDF URLs, pages and original observed KP are retained per endpoint.
OSM longitude/latitude is stored here as **[latitude, longitude]**.

The build first preserves the existing Miyoshi mainline correction and
Hiroshima-Iwakuni 0–1.5 KP calibration, then runs `kp-calibration.mjs`.
Bridge references are projected onto the existing continuous common mainline.
KP coordinates are interpolated along its full road geometry between the
references and unchanged outer boundary coordinates. Road lines, facility
coordinates, KP numbers, coverage and count are preserved.

| Road | Calibrated span | Changed 0.1 KP records | References |
|---|---|---:|---|
| Sanyo | 315.0–332.6 | 175 | Misono viaduct |
| Sanyo | 252.6–257.8 | 51 | Hiyama viaduct |
| Sanyo | 401.3–407.2 | 58 | Urushi bridge, Urushi viaduct, Iai bridge |
| Chugoku | 353.0–360.4 | 73 | Chugoku Otagawa bridge |
| Chugoku | 376.6–380.4 | 37 | Unoko bridge |

Chugoku spans include short transition regions beyond the original suspect
intervals to avoid compressed 100m spacing at their edges. No unverified
candidate interval is automatically corrected.

These remain reference coordinates, **not surveyed milestone coordinates**.
The common mainline does not model different stationing on each carriageway.
Bridge endpoint location, historical plan alignment and intervening
interpolation have separate uncertainties. Anchor agreement in the emitted
KP array does not establish equivalent geographic accuracy.

The build audits all 8,682 records on the four visible routes before and after
calibration. It fails on missing/duplicate/reversed KP, non-finite coordinates,
severe spacing anomalies, disconnected geometry, off-road references, changed
upstream stationing, reversed controls or excessive interpolation stretch.
`dist/kp-calibration-report.json` contains before/after metrics and per-span
movement. `npm test` also checks the 14 references against emitted coordinates
and guards against erroneous source updates.

The existing build patches modify `build.mjs`; start builds from the tracked
unpatched version and do not commit the generated patched file.
