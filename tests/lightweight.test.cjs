const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const keys = ['sanyo','chugoku','hiroshima','hiroshima_iwakuni'];
const data = require('./read-route-data.cjs')();
assert.deepEqual(Object.keys(data).sort(),keys.slice().sort());
const context = {window:{}};
vm.runInNewContext(fs.readFileSync('dist/traffic-landmarks.js','utf8'),context);
const catalogue = JSON.parse(JSON.stringify(context.window.KPMAP_TRAFFIC_LANDMARKS));
const original = require('../traffic-landmarks.json');
assert.deepEqual(Object.keys(catalogue.routes).sort(),keys.slice().sort());
const omitted = new Set(['structureDetails','osmWays','osmNodes']);
for(const key of keys) {
  assert.deepEqual(catalogue.routes[key],JSON.parse(JSON.stringify(original.routes[key],
    (name,value)=>omitted.has(name)?undefined:value)), 'All names, positions, aliases, portal directions and paths must be retained');
}
assert.deepEqual(catalogue.sources,original.sources,'Source attribution retained');

// Execute the actual list update helper to detect unnecessary DOM rebuilds.
const code = fs.readFileSync('traffic-client.js','utf8');
const helper = code.slice(code.indexOf('  let listHtmlCache ='),code.indexOf("  list.addEventListener('click'"));
let writes=0,value='';
const list={set innerHTML(html){writes++;value=html;}};
const env={list};vm.createContext(env);vm.runInContext(helper,env);
vm.runInContext("updateListHtml('unchanged');updateListHtml('unchanged');",env);
assert.equal(writes,1,'Identical location/list output must not rebuild cards');
vm.runInContext("updateListHtml('changed');",env);
assert.equal(writes,2);assert.equal(value,'changed');
console.log('PASS: four-road runtime payload, unchanged landmark semantics and skipped duplicate DOM writes');
