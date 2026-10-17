import fs from 'node:fs';

// Keep the complete investigation catalogue in source control. Only ship
// runtime references used by the four supported roads to the browser.
const allowed = new Set(['sanyo', 'chugoku', 'hiroshima', 'hiroshima_iwakuni']);
const source = JSON.parse(fs.readFileSync('traffic-landmarks.json', 'utf8'));
const unused = new Set(['structureDetails', 'osmWays', 'osmNodes']);
const compact = JSON.parse(JSON.stringify({ ...source,
  routes: Object.fromEntries(Object.entries(source.routes).filter(([key]) => allowed.has(key)))
}, (key, value) => unused.has(key) ? undefined : value));
// Audit summaries are build-time diagnostics, not runtime map inputs.
delete compact.audit;
fs.writeFileSync('dist/traffic-landmarks.js', 'window.KPMAP_TRAFFIC_LANDMARKS=' + JSON.stringify(compact) + ';');
const summary = JSON.parse(fs.readFileSync('dist/route-summary.json', 'utf8'));
if (Object.keys(summary).length !== 4 || Object.keys(summary).some(k => !allowed.has(k)))
  throw Error('Runtime route payload must contain only the four supported roads');
console.log('Shipped four-road runtime catalogue:', fs.statSync('dist/traffic-landmarks.js').size, 'bytes');
