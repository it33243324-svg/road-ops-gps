import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

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

// Content addresses allow long-lived browser caching without stale releases.
// HTML and /api/traffic remain revalidated/uncached; only immutable assets use
// the /assets/ cache policy. Keep legacy files for diagnostics and preview pages.
fs.rmSync('dist/assets/cache', { recursive: true, force: true });
fs.mkdirSync('dist/assets/cache', { recursive: true });
const versioned = (name, content) => {
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  const url = '/assets/cache/' + name + '.' + hash + '.js';
  fs.writeFileSync('dist' + url, content);
  return url;
};
let html = fs.readFileSync('dist/index.html', 'utf8');
const data = html.match(/const D=(\{.*?\}),\$=x=>/s);
if (!data) throw Error('Route data extraction anchor missing');
const routeUrl = versioned('routes-data', 'window.KPMAP_ROUTES=' + data[1] + ';');
html = html.replace('<script>const D=' + data[1],
  '<script src="' + routeUrl + '" id="kpmap-route-data"></script><script>const D=window.KPMAP_ROUTES');
if (!html.includes('id="kpmap-route-data"')) throw Error('Route data script insertion failed');
html = html.replace(/<script src="(\/[^"?]+\.js)"><\/script>/g, (tag, url) => {
  if (url.startsWith('/assets/')) return tag;
  const file = path.join('dist', url);
  if (!fs.existsSync(file)) throw Error('Missing runtime script: ' + url);
  return '<script src="' + versioned(path.basename(url, '.js'), fs.readFileSync(file)) + '"></script>';
});
// Fetch independent scripts alongside Leaflet; execute them in their original
// synchronous order so initialization and global references remain unchanged.
const urls = [...html.matchAll(/<script src="(\/assets\/[^" ]+)"/g)].map(m => m[1]);
html = html.replace('</head>', urls.map(url => '<link rel="preload" as="script" href="' + url + '">').join('') + '</head>');
fs.writeFileSync('dist/index.html', html);
console.log('Cacheable content-addressed scripts:', urls.length, '; HTML bytes:', Buffer.byteLength(html));
