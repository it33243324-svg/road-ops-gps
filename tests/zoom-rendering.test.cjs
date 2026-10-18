const assert=require('node:assert/strict'),create=require('./app-harness.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(dir){
 const app=await create(dir,{width:390,height:844}),w=app.window,map=app.map,D=w.eval('D');
 const point=D.sanyo.marks.find(m=>m[0]===296);map.setView([point[1],point[2]],16,{animate:false});await wait(160);
 let labels=0,styles=0;const old=w.eval('labels');w.__labels=()=>{labels++;old();};w.eval('labels=window.__labels');
 const original=w.L.Path.prototype.setStyle;w.L.Path.prototype.setStyle=function(options){styles++;return original.call(this,options)};
 const center=map.getCenter();map._moveStart(true,false);
 for(let i=1;i<=60;i++){map._move(center,16-i*.1,{pinch:true,round:false});await wait(16);}
 const during={labels,styles};map._moveEnd(true);await wait(180);
 if(dir==='dist')assert.equal(during.labels,0,'Pinch frames retain existing labels rather than rebuilding them');
 assert(!w.document.body.classList.contains('kpmap-map-zooming'));
 const kp=w.eval('[...kpMarkers.values()]');
 for(const route of Object.values(D))for(const mark of route.marks)if(map.getBounds().contains([mark[1],mark[2]])&&w.eval('showK')(mark[0],w.eval('step')()))assert(kp.some(m=>m.getLatLng().lat===mark[1]&&m.getLatLng().lng===mark[2]),'Final zoom KP missing');
 const before=styles;map.fire('zoomend');await wait(50);const sameWidthUpdates=styles-before;
 assert.deepEqual(app.errors,[]);app.close();return{dir,during,after:{labels,styles},sameWidthUpdates};
}
(async()=>{if(process.argv[2])console.log(JSON.stringify(await run(process.argv[2])));const current=await run('dist');assert.equal(current.sameWidthUpdates,0,'Unchanged zoom widths do not rewrite path styles');console.log(JSON.stringify(current));console.log('PASS: pinch-phase label deferral, final KP coverage, effect resumption and skipped identical stroke writes');})().catch(e=>{console.error(e);process.exit(1)});
