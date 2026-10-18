const assert=require('node:assert/strict'),fs=require('node:fs');
const spatial=require('../map-spatial.js');
const routes=require('./read-route-data.cjs')();
const km=(a,b)=>{const r=Math.PI/180,h=Math.sin((b[0]-a[0])*r/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin((b[1]-a[1])*r/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)));};
function bruteRoute(route,p){
  let best=null;const cos=Math.cos(p[0]*Math.PI/180);
  for(const line of route.segs)for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i],ax=(a[1]-p[1])*cos,ay=a[0]-p[0],bx=(b[1]-p[1])*cos,by=b[0]-p[0],dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
    const point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],distance=km(p,point);
    if(!best||distance<best.distance)best={point,distance};
  }return best;
}
function bruteKp(route,p){
  let best=null;for(const mark of route.marks){const distance=km(p,mark.slice(1));if(!best||distance<best.distance)best={value:mark[0],distance};}return best;
}
let cases=0;
for(const route of Object.values(routes)){
  for(const m of route.marks)for(const delta of [[0,0],[.0003,-.0004],[-.004,.003]]){
    const p=[m[1]+delta[0],m[2]+delta[1]],actual=spatial.nearestOnRoute(route,p),expected=bruteRoute(route,p);
    assert(Math.abs(actual.distance-expected.distance)<1e-8,'Exact nearest-road distance must match the full scan');
    assert(km(actual.point,expected.point)<1e-7,'Projected road point must match the full scan');
    const got=spatial.nearestKp(route,p),want=bruteKp(route,p);
    assert.equal(got.value,want.value,'KP selection must not change');cases++;
  }
  for(const p of [[0,0],[90,180],[-90,-180],[35,179],[35,-179],[35,134],[34,132]]){
    const a=spatial.nearestOnRoute(route,p),b=bruteRoute(route,p);
    assert(Math.abs(a.distance-b.distance)<1e-7,'Distant-point pruning must remain conservative');
    assert.equal(spatial.nearestKp(route,p).value,bruteKp(route,p).value);cases++;
  }
}
const tie={marks:[[0,34,132],[.1,34,132]],segs:[[[34,132],[34,132]]]};
assert.equal(spatial.nearestKp(tie,[34,132]).value,0,'Duplicate-coordinate ties retain the first KP');
assert.equal(spatial.nearestOnRoute(tie,[34,132]).distance,0,'Zero-length geometry is safe');
assert.equal(spatial.nearestKp(tie,[NaN,132]),null);
assert.equal(spatial.nearestOnRoute(tie,[91,132]),null);
assert.equal(spatial.nearestOnRoute({segs:[]},[34,132]),null);
const replace={marks:[[0,34,132]],segs:[[[34,132],[34.01,132]]]};
assert.equal(spatial.nearestKp(replace,[34,132]).value,0);
replace.marks=[[1,34,132]];assert.equal(spatial.nearestKp(replace,[34,132]).value,1,'Replacing data invalidates its index');
console.log('PASS: '+cases+' real-road/offset/global spatial comparisons against full scans, ties, invalid points and cache replacement');
