# Map controls and traffic display

The traffic list keeps the 20 km default and all existing radius choices. Incidents
and other traffic information appear in the upper section; construction and traffic
regulation appear in the lower section. Each section sorts by distance from the
current GPS location. Each map event has its own marker at its resolved point;
there is no clustering. Separate panes enforce front-to-back priority:
closure, accident, broken vehicle, falling object, other, construction/regulation.

The red time is **KPMAP's successful fetch time, in Asia/Tokyo**, not an incident's
occurrence time. The iHighway area07 records inspected on 2026-10-03 contain only
title, direction, reason, detail and schematic coordinate fields. They do not
provide occurrence times. No guessed event age or browser first-seen time is shown.
The display helper accepts only an explicit absolute `occurredAt` timestamp if a
future validated source provides it. A failed update preserves prior data and its
timestamp, marks the failed refresh, and retries at the normal schedule.

Traffic refreshes every minute while the page is visible. Returning to the
page refreshes if the last successful fetch is at least 30 seconds old; coming back
online also refreshes. Mobile browsers can suspend hidden tabs or locked screens;
this is not a background service or push-notification implementation.

## Controls (below zoom and the existing red location button)

1. Fullscreen: native Fullscreen API where available, CSS viewport fallback otherwise.
   Escape / the same button exits. The selected KP's existing Google Map action
   stays available in fullscreen. Fullscreen preserves map state and KP selection.
2. Follow: center on fresh accepted GPS updates, preserving zoom.
3. North / heading-up: use the last recently confirmed vehicle direction to put
   travel at the top; toggling back resets north to the top. Heading-up enables
   follow. Manual pan, KP input/jump, route changes and traffic-card navigation
   stop following so user exploration is never undone by the next GPS update.

GPS remains high accuracy and now requests uncached fixes (`maximumAge: 0`).
Old/out-of-order results, implausible leaps and briefly degraded accuracy are
filtered. Only tiny stationary jitter is damped; moving vehicles retain their GPS
coordinates. No artificial road snapping or promise of hardware precision is made.
The vehicle direction gate (40 km/h or more for at least 30 seconds of continuous good fixes) is
preserved; walking never changes travel direction. Position marker/wave DOM is
reused so GPS updates do not restart its ripple animation.

## Rotation dependency

Vendored `@tomickigrzegorz/leaflet-rotate` 0.3.0 (MIT), npm tarball integrity verified,
https://github.com/tomickigrzegorz/leaflet-rotate . Original minified code and license
are in `vendor/`. A separate `map-rotation-compat.js` shim supplies the map argument
when Leaflet 1.9.4's Canvas renderer calls Renderer.onAdd without it. Upstream vendor
code is unchanged. Keep the license with the bundle.

## Verification

```sh
npm install
npm run build
npm test
```

Build in a fresh checkout: the original patch-based build edits `build.mjs` in place.
Tests use the actual 42-event fixture solely in tests. DOM regression checks load
the real Leaflet code and the complete generated page; canvas drawing is stubbed,
so public-browser visual verification is also needed. GPS motion is simulated only
in tests. Coverage includes separate markers, nearby radius, ranking/distance,
unknown occurrence times, fresh GPS, walk/car direction, rotated coordinate
projection, KP click/input/jump/Google controls, 135 existing facility labels,
follow/manual-pan, fullscreen fallback and refresh-failure recovery. Live GPS
precision and mobile OS fullscreen behavior still depend on the user's device.

Fullscreen controls move 10 px inward, respecting device safe areas; the Google Map action sits beside zoom with the original selection ripple. F toggles fullscreen outside editable fields; Escape still exits. Location road/direction/KP occupy one row. Custom KP, location and traffic panes share the upright marker stacking context, with traffic above KP and its popups above labels. Direction confirmation shows 判定中; errors and insufficient evidence show 取得できません. Speed below 40 km/h or gaps over 10 seconds restart the 30-second confirmation. The API requests uncached upstream data; one-minute polling is independent of the upstream publication schedule.
