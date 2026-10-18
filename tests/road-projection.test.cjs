const assert=require('node:assert/strict'),create=require('./app-harness.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const a=await create('dist',{width:390,height:844}),w=a.window,m=a.map,D=w.eval('D');
 let projections=0;const original=m.latLngToLayerPoint;m.latLngToLayerPoint=function(...args){projections++;return original.apply(this,args)};
 let comparisons=0;
 for(const z of [9,10.1,12,14.4,16,18])for(const key of Object.keys(D)){
  const mark=D[key].marks[Math.floor(D[key].marks.length/2)];m.setView([mark[1],mark[2]],z,{animate:false});m.setBearing((z*13)%360);await wait(30);
  for(const source of D[key].segs){
   const shared=w.KPMAPRoadPolyline(source,{weight:14,interactive:false}).addTo(m),reference=w.L.polyline(source,{weight:14,interactive:false}).addTo(m);
   const rings=line=>Array.from(line._rings,r=>Array.from(r,p=>[p.x,p.y]));assert.deepEqual(rings(shared),rings(reference));
   assert.deepEqual(Array.from(shared._parts,r=>Array.from(r,p=>[p.x,p.y])),Array.from(reference._parts,r=>Array.from(r,p=>[p.x,p.y])),'Clipped and simplified canvas geometry must also remain exact');
   assert.equal(shared._rawPxBounds.min.x,reference._rawPxBounds.min.x);assert.equal(shared._rawPxBounds.max.y,reference._rawPxBounds.max.y);
   const before=projections;shared._project();assert.equal(projections,before,'An unchanged camera reuses projected coordinates');
   m.removeLayer(shared);m.removeLayer(reference);comparisons++;
  }
 }
 const path=[[34.4,132.4],[34.41,132.41],[34.42,132.42]],one=w.KPMAPRoadPolyline(path,{noClip:true,smoothFactor:100}).addTo(m),two=w.KPMAPRoadPolyline(path,{weight:14}).addTo(m),reference=w.L.polyline(path).addTo(m);
 one._update();two._project();assert.equal(two._rings[0].length,reference._rings[0].length,'One stroke cannot simplify another cached ring');
 one.setLatLngs([[34.5,132.5],[34.51,132.51]]);assert.notEqual(one._rings[0][0].x,two._rings[0][0].x,'Editing one stroke isolates its cache');
 one.addLatLng([34.52,132.52]);assert.equal(one._rings[0].length,3);
 assert.deepEqual(a.errors,[]);a.close();console.log('PASS: '+comparisons+' exact road projection comparisons across zooms/bearings, shared reuse, clipping independence and geometry edits');
})().catch(e=>{console.error(e);process.exit(1)});
