// Real-time, phone-sized GPS follow/heading replay. No device FPS claim.
const assert=require('node:assert/strict'),fs=require('fs'),create=require('./app-harness.cjs'),read=require('./read-route-data.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const minutes=Number(process.argv[2]||52),out=process.argv[3]||'/tmp/kpmap-follow-soak.json';
 const app=await create('dist',{width:390,height:844}),w=app.window,doc=w.document,map=app.map;
 let labelPasses=0;const original=w.eval('labels');w.__labels=()=>{labelPasses++;original();};w.eval('labels=window.__labels');
 const marks=read().sanyo.marks,begin=marks.findIndex(m=>m[0]===280),start=Date.now(),records=[];let cpuMs=0;
 for(let tick=0;tick<minutes*60;tick++){
  app.now=start+tick*1000;const index=begin+Math.floor(tick/4),a=marks[index],b=marks[index+1],f=(tick%4)/4;
  const p=[a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f],heading=(Math.atan2((b[2]-a[2])*Math.cos(p[0]*Math.PI/180),b[1]-a[1])*180/Math.PI+360)%360;
  const t=performance.now();app.gps(p,heading);cpuMs+=performance.now()-t;
  if(tick===0){map.setZoom(15,{animate:false});doc.querySelectorAll('.map-tool')[1].click();}
  if(tick>0&&tick%300===0){doc.querySelectorAll('.map-tool')[2].click();doc.querySelectorAll('.map-tool')[1].getAttribute('aria-pressed')==='false'&&doc.querySelectorAll('.map-tool')[1].click();}
  if(tick&&tick%60===0){
   await app.minute();
   const r={minute:tick/60,labelPasses,nodes:doc.querySelectorAll('*').length,trafficIcons:doc.querySelectorAll('.traffic-event-marker').length,detailLabels:doc.querySelectorAll('.detail-label').length,kpLabels:doc.querySelectorAll('.kplabel').length,bearing:map.getBearing(),heapMB:process.memoryUsage().heapUsed/1048576,cpuMs,summary:app.summary()};records.push(r);fs.writeFileSync(out,JSON.stringify({status:'running',ticks:tick,records},null,2));console.log(JSON.stringify(r));
  }
  assert.equal(doc.querySelectorAll('.map-tool')[1].getAttribute('aria-pressed'),'true');
  assert(map.distance(map.getCenter(),p)<100,'Follow center remains at the fresh GPS fix');
  assert.deepEqual(app.errors,[]);
  const remaining=start+(tick+1)*1000-Date.now();if(remaining>0)await wait(remaining);
 }
 const result={status:'passed',ticks:minutes*60,elapsedSeconds:(Date.now()-start)/1000,cpuMs,records};fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));app.close();
})().catch(e=>{console.error(e);process.exit(1)});
