const assert=require('node:assert/strict'),create=require('./app-harness.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(dir){
 const a=await create(dir,{width:390,height:844}),w=a.window,map=a.map,D=w.eval('D'),doc=w.document;
 const p=D.sanyo.marks.find(m=>m[0]===296),center=w.KPMAP_TRAFFIC_LANDMARKS.routes.sanyo.find(x=>x.name.includes('水晶')&&x.type==='tunnel').point;map.setView(center,15,{animate:false});await wait(200);
 let passes=0,detailReads=0;const old=w.eval('labels');w.__labels=()=>{passes++;old();};w.eval('labels=window.__labels');
 const rect=w.HTMLElement.prototype.getBoundingClientRect;w.HTMLElement.prototype.getBoundingClientRect=function(){if(this.matches('.detail-label'))detailReads++;return rect.call(this)};
 map.fire('movestart');map.fire('dragstart');if(dir==='dist')assert(doc.body.classList.contains('kpmap-map-dragging'),'Decorations pause while dragging');const start=performance.now();
 for(let i=0;i<60;i++){
  map._rawPanBy(w.L.point(12,0));map.fire('move');await wait(16);
 }
 const during={passes,detailReads},motionMs=performance.now()-start;
 map._rawPanBy(w.L.point(-720,0));map.fire('move');map.fire('dragend');map.fire('moveend');await wait(250);
 if(dir==='dist')assert(!doc.body.classList.contains('kpmap-map-dragging'),'Decorations resume after movement');
 const markers=w.eval('[...facilityMarkers.values()]');
 for(const route of Object.values(D))for(const f of route.facilities)if(map.getBounds().contains([f.lat,f.lng]))assert(markers.some(m=>m.getLatLng().lat===f.lat&&m.getLatLng().lng===f.lng),'Final viewport facility missing: '+f.name);
 const visible=Object.values(D).flatMap(route=>route.marks).filter(m=>map.getBounds().contains([m[1],m[2]])&&w.eval('showK')(m[0],w.eval('step')()));
 const kp=w.eval('[...kpMarkers.values()]');for(const m of visible)assert(kp.some(x=>x.getLatLng().lat===m[1]&&x.getLatLng().lng===m[2]),'Final visible KP missing');
 assert.deepEqual(a.errors,[]);const after={passes,detailReads};a.close();return{dir,during,after,motionMs};
}
(async()=>{const baseline=process.argv[2];if(baseline)console.log(JSON.stringify(await run(baseline)));const current=await run('dist');assert.equal(current.during.detailReads,0,'Detailed collision layout waits until dragging stops');assert(current.after.detailReads>0,'Detail placement resumes after movement');assert(current.during.passes<=10,'KP refill is coalesced during the drag');console.log(JSON.stringify(current));console.log('PASS: drag refill coalescing, deferred detail layout and complete final KP/facility coverage');})().catch(e=>{console.error(e);process.exit(1)});
