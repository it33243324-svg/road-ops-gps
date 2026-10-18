// Reproducible synchronous work comparison, not a device FPS measurement.
const create=require('./app-harness.cjs'),assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(directory){
 const app=await create(directory,{width:390,height:844}),w=app.window,doc=w.document;
 const marker=Object.values(app.map._layers).find(m=>m.options?.icon?.options?.className==='traffic-event-marker');
 const p=marker.getLatLng();app.map.setView([p.lat,p.lng],15,{animate:false});await wait(50);
 let scans=0,cardRemoved=0;const original=w.eval('labels');w.__labels=()=>{scans++;original();};w.eval('labels=window.__labels');
 const observer=new w.MutationObserver(records=>{for(const r of records)for(const n of r.removedNodes)if(n.nodeType===1)cardRemoved+=n.matches?.('.traffic-card[data-event]')?1:n.querySelectorAll?.('.traffic-card[data-event]').length||0;});
 observer.observe(doc.querySelector('#trafficList'),{childList:true,subtree:true});
 let cpu=0;const summaries=[];
 for(let i=0;i<180;i++){app.now+=1000;const t=performance.now();app.gps([p.lat+i*.00001,p.lng+i*.00004],90,25,8);cpu+=performance.now()-t;summaries.push(app.summary());if(i%10===0)await wait(1);}
 await wait(50);const result={directory,gpsUpdates:180,labelsScans:scans,removedCards:cardRemoved,cpuMs:cpu,summaries};
 assert.deepEqual(app.errors,[]);observer.disconnect();app.close();return result;
}
(async()=>{const dirs=process.argv.slice(2);let last;for(const dir of dirs.length?dirs:['dist']){const result=await run(dir);if(last)assert.deepEqual(result.summaries,last.summaries,'Displayed road/KP/direction remain identical');last=result;const {summaries,...report}=result;console.log(JSON.stringify(report));}})().catch(e=>{console.error(e);process.exit(1)});
