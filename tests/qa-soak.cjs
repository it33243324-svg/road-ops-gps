// Exercise four road/viewport scenarios with synthetic GPS at one-second cadence.
// Set KPMAP_SOAK_FAST=1 for an accelerated preflight; the standard run uses real time.
const assert=require('node:assert/strict'),fs=require('node:fs');
const createHarness=require('./app-harness.cjs'),readRoutes=require('./read-route-data.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const minutes=Number(process.argv[2]||30),out=process.argv[3]||'/tmp/kpmap-qa-soak.json',fast=process.env.KPMAP_SOAK_FAST==='1';
  const routes=readRoutes(),cases=[['sanyo',290,1280,900],['chugoku',350,390,844],['hiroshima',4,844,390],['hiroshima_iwakuni',0,375,812]];
  const apps=[];
  for(const [key,kp,width,height]of cases){
    const app=await createHarness('dist',{width,height});app.key=key;app.originalFeed=JSON.parse(JSON.stringify(app.feed));
    app.marks=routes[key].marks;app.base=app.marks.findIndex(m=>m[0]===kp);app.span=Math.min(100,app.marks.length-app.base-1);
    const select=app.window.document.querySelector('#r');select.value=key;select.dispatchEvent(new app.window.Event('change'));
    apps.push(app);
  }
  const start=Date.now(),ticks=minutes*60,records=[];
  for(let tick=0;tick<ticks;tick++){
    for(const app of apps){
      const w=app.window,doc=w.document;app.now=start+tick*1000;
      const phase=(tick/4)%(app.span*2),offset=phase<=app.span?phase:app.span*2-phase;
      const index=Math.min(app.span-1,Math.floor(offset)),f=offset-index,a=app.marks[app.base+index],b=app.marks[app.base+index+1];
      const p=[a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
      const increasing=phase<app.span;
      const heading=(Math.atan2((b[2]-a[2])*Math.cos(p[0]*Math.PI/180),b[1]-a[1])*180/Math.PI+(increasing?360:540))%360;
      app.gps(p,heading);
      if(process.env.KPMAP_SOAK_ROTATE==='1'&&tick%15===10)app.map.setBearing((tick*3)%360);
      assert(Number.isFinite(w.KPMAPLocation.getLatest()?.point?.[0]));
      if(tick>0&&tick%180===60){
        app.gpsError({code:3});assert(app.watchActive,'Transient GPS timeout must keep the registered watch');
        app.gps(p,heading);assert(!doc.querySelector('#locationRoad').textContent.includes('許可'));
      }
      if(tick>0&&tick%180===120){
        app.gpsError({code:1});assert(!app.watchActive,'Denied GPS permission must stop the watch');
        doc.querySelector('.map-recenter').click();assert(app.watchActive,'Explicit retry restarts GPS');app.gps(p,heading);
      }
      if(tick%60===0){
        const minute=tick/60,action=minute%10;
        if(action===0){app.map.setZoom(10);}
        if(action===1){app.map.setZoom(16);}
        if(action===2){
          const input=doc.querySelector('#q');input.value=String(a[0]);input.dispatchEvent(new w.Event('input',{bubbles:true}));
          assert(!doc.querySelector('#go').disabled);doc.querySelector('#gmap').click();
          assert(app.openedUrls.at(-1)[0].startsWith('https://www.google.com/maps/search/?api=1&query='));
          input.value='9999';input.dispatchEvent(new w.Event('input',{bubbles:true}));assert(doc.querySelector('#go').disabled);
          input.value='';input.dispatchEvent(new w.Event('input',{bubbles:true}));
        }
        if(action===3){doc.querySelector('.map-tool').click();await wait(25);assert(doc.querySelector('#m').classList.contains('map-fullscreen'));doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));}
        if(action===4){doc.querySelectorAll('.map-tool')[1].click();app.map.fire('dragstart');assert.equal(doc.querySelectorAll('.map-tool')[1].getAttribute('aria-pressed'),'false');}
        if(action===5){
          const date=doc.querySelector('#trafficUpdated').dateTime;app.offline=true;await app.minute();
          assert(doc.querySelector('#trafficUpdated').classList.contains('is-stale'));assert.equal(doc.querySelector('#trafficUpdated').dateTime,date);
          app.offline=false;await app.minute();assert(!doc.querySelector('#trafficUpdated').classList.contains('is-stale'));
        }
        if(action===6){
          app.feed=JSON.parse(JSON.stringify(app.originalFeed));
          for(const category of ['jam','closed'])app.feed.events.push({...app.feed.events[0],road:routes[app.key].name,
            category,categoryLabel:category==='jam'?'渋滞':'通行止',title:(category==='jam'?a[0]:app.marks[(app.base+index+7)%app.marks.length][0])+'KP付近',reason:'test-only soak incident'});
          await app.minute();assert(doc.querySelector('.traffic-pin.jam'));assert(doc.querySelector('.traffic-pin.closure'));
        }
        if(action===7){app.feed=JSON.parse(JSON.stringify(app.originalFeed));await app.minute();}
        if(action===8){app.hidden=true;const before=app.fetches;await app.minute();assert.equal(app.fetches,before);app.hidden=false;doc.dispatchEvent(new w.Event('visibilitychange'));}
        if(action===9){app.width=app.width<600?844:390;app.height=app.width<600?844:390;app.map.invalidateSize({animate:false});}
        await app.minute();
      }
      assert.deepEqual(app.errors,[],app.key+' must remain free of uncaught errors');
    }
    if(tick&&tick%60===0){
      const record={minute:tick/60,heapMB:process.memoryUsage().heapUsed/1048576,
        apps:apps.map(a=>({road:a.key,summary:a.summary(),nodes:a.window.document.querySelectorAll('*').length,fetches:a.fetches,watches:a.watchStarts}))};
      records.push(record);fs.writeFileSync(out,JSON.stringify({status:'running',ticks:tick,records},null,2));console.log(JSON.stringify(record));
    }
    if(fast)await wait(1);else{const remaining=start+(tick+1)*1000-Date.now();if(remaining>0)await wait(remaining);}
  }
  const result={status:'passed',fast,ticksPerRoad:ticks,roads:apps.length,elapsedSeconds:(Date.now()-start)/1000,records};
  fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));apps.forEach(a=>a.close());
}
main().catch(e=>{console.error(e);process.exit(1);});
