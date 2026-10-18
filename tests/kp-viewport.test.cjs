const assert=require('node:assert/strict'),spatial=require('../map-spatial.js'),routes=require('./read-route-data.cjs')(),create=require('./app-harness.cjs');
let count=0;
for(const route of Object.values(routes))for(let i=0;i<route.marks.length;i+=5){const m=route.marks[i];for(const span of [0,.001,.03,.5]){
 const bounds={south:m[1]-span,north:m[1]+span,west:m[2]-span,east:m[2]+span};
 const expected=route.marks.filter(x=>x[1]>=bounds.south&&x[1]<=bounds.north&&x[2]>=bounds.west&&x[2]<=bounds.east);
 assert.deepEqual(spatial.marksInBounds(route,bounds),expected);count++;
}}
const replace={marks:[[0,34,132]]},box={south:34,north:34,west:132,east:132};assert.equal(spatial.marksInBounds(replace,box).length,1);replace.marks=[[1,35,133]];assert.equal(spatial.marksInBounds(replace,box).length,0);
assert.deepEqual(spatial.marksInBounds(replace,{...box,south:NaN}),[]);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const a=await create('dist',{width:390,height:844}),w=a.window,m=a.map,D=w.eval('D');let views=0;
 for(const [key,route]of Object.entries(D)){const selected=route.marks[Math.floor(route.marks.length*.53)];w.__chosen=selected;w.eval('pickedKp=[...window.__chosen.slice(1),window.__chosen[0]]');
  for(const z of [9,10.1,12,14,16,18]){m.setView([selected[1],selected[2]],z,{animate:false});await wait(35);const bounds=m.getBounds().pad(.5),density=w.eval('step')();
   for(const road of Object.keys(D)){const old=w.eval('kpRows')(road,density).filter(x=>bounds.contains([x[1],x[2]])),next=w.eval('kpRowsInBounds')(road,density,bounds);assert.deepEqual(Array.from(next,x=>Array.from(x)),Array.from(old,x=>Array.from(x)),'Exact selected-KP and density order must match full scans');views++;}
  }
 }
 assert.deepEqual(a.errors,[]);a.close();console.log('PASS: '+count+' inclusive viewport index/full-scan comparisons and '+views+' actual label candidate/order comparisons, selected KP, index replacement and invalid bounds');})().catch(e=>{console.error(e);process.exit(1)});
