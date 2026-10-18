const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const html=fs.readFileSync('dist/index.html','utf8');
const scripts=[...html.matchAll(/<script src="(\/[^" ]+)"/g)].map(m=>m[1]);
assert(scripts.length>15);
for(const url of scripts){
  assert(url.startsWith('/assets/cache/'),'Every local runtime script must use the immutable content-addressed directory');
  const content=fs.readFileSync(path.join('dist',url));
  const hash=crypto.createHash('sha256').update(content).digest('hex').slice(0,16);
  assert(url.endsWith('.'+hash+'.js'),'Cache address must match file contents');
  assert(html.includes('<link rel="preload" as="script" href="'+url+'">'),'Versioned data should be fetched before parser reaches its execution point');
}
const names=scripts.map(url=>path.basename(url).split('.')[0]);
assert(names.indexOf('map-spatial')<names.indexOf('location-client'));
assert(names.indexOf('routes-data')<names.indexOf('traffic-client'));
assert(names.indexOf('traffic-landmarks')<names.indexOf('traffic-client'));
assert(!html.includes('const D={'),'KP data is reusable independently of HTML');
const policy=require('../vercel.json').headers;
assert.deepEqual(policy,[{source:'/assets/cache/:path*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]}],
  'Cache only hashed static assets; keep live traffic and mutable assets outside the policy');
console.log('PASS: '+scripts.length+' content-addressed/preloaded assets, script order, narrowly scoped cache headers');
