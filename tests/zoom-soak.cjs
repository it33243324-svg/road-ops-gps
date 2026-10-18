// Real-time stress of Leaflet's pinch lifecycle; this measures correctness and
// bounded DOM/cache behavior, not hardware touch latency or GPU frame rate.
const assert=require('node:assert/strict'),fs=require('node:fs'),create=require('./app-harness.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const deadline=Number(process.argv[2]||Date.now()+50*60000),out=process.argv[3]||'/tmp/kpmap-zoom-soak.json',apps=[],records=[],start=Date.now();
 for(const [key,width,height] of [['sanyo',390,844],['chugoku',844,390],['hiroshima',375,812],['hiroshima_iwakuni',1280,900]]){
  const a=await create('dist',{width,height});a.key=key;a.D=a.window.eval('D');const select=a.window.document.querySelector('#r');select.value=key;select.dispatchEvent(new a.window.Event('change'));apps.push(a);
 }
 let cycles=0,gestures=0,frames=0;
 while(Date.now()<deadline){
  const due=start+(cycles+1)*5000;
  for(const a of apps){
   const w=a.window,m=a.map,doc=w.document,marks=a.D[a.key].marks,point=marks[Math.floor((cycles%20)/20*(marks.length-1))],z=[10,12,14,16,18,13,11][cycles%7];
   m.setView([point[1],point[2]],z,{animate:false});a.now=Date.now();a.gps([point[1],point[2]],cycles*17%360);
   if(cycles%6===0)m.setBearing(cycles*11%360);
   const center=m.getCenter(),end=z===18?16:z+0.9;m._moveStart(true,false);
   for(let frame=1;frame<=20;frame++){m._move(center,z+(end-z)*frame/20,{pinch:true,round:false});frames++;await wait(10);}
   m._moveEnd(true);gestures++;await wait(50);
   assert(!doc.body.classList.contains('kpmap-map-zooming'),'Zoom effects must resume');
   const visible=w.eval('[...kpMarkers.values()]'),step=w.eval('step')(),show=w.eval('showK');
   for(const route of Object.values(a.D))for(const mark of route.marks)if(m.getBounds().contains([mark[1],mark[2]])&&show(mark[0],step))assert(visible.some(x=>x.getLatLng().lat===mark[1]&&x.getLatLng().lng===mark[2]),'Missing final visible KP on '+a.key);
   if(cycles%12===0){a.width=a.width<600?844:390;a.height=a.width<600?844:390;m.invalidateSize({animate:false});await a.minute();}
   if(cycles%12===6){m.fire('dragstart');m._rawPanBy(w.L.point(40,0));m.fire('move');m.fire('dragend');m.fire('moveend');await wait(120);assert(!doc.body.classList.contains('kpmap-map-dragging'));}
   assert.deepEqual(a.errors,[]);assert(Number.isFinite(w.KPMAPLocation.getLatest().point[0]));
  }
  cycles++;
  if(cycles%12===0){const record={seconds:Math.round((Date.now()-start)/1000),cycles,gestures,frames,heapMB:Math.round(process.memoryUsage().heapUsed/1048576),apps:apps.map(a=>({road:a.key,nodes:a.window.document.querySelectorAll('*').length,errors:a.errors.length}))};records.push(record);fs.writeFileSync(out,JSON.stringify({status:'running',start,deadline,records},null,2));console.log(JSON.stringify(record));}
  await wait(Math.max(0,Math.min(due,deadline)-Date.now()));
 }
 const result={status:'passed',start,end:Date.now(),elapsedSeconds:(Date.now()-start)/1000,cycles,gestures,frames,records};fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,records:records.length}));apps.forEach(a=>a.close());
})().catch(e=>{console.error(e);process.exit(1)});
