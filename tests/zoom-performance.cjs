// Compare equivalent real Leaflet zoom operations. CPU time includes deliberate
// settling waits and is not a display FPS measurement.
const create=require('./app-harness.cjs'),fs=require('fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const results=[];for(const dir of [process.argv[2]||'../kpmap-drag-performance/dist','dist']){
 const a=await create(dir,{width:390,height:844}),w=a.window,m=a.map,D=w.eval('D'),p=D.sanyo.marks.find(x=>x[0]===296);m.setView([p[1],p[2]],12,{animate:false});await wait(100);
 let projectedPoints=0,styleWrites=0;const original=w.L.Polyline.prototype._projectLatlngs,style=w.L.Path.prototype.setStyle;
 w.L.Polyline.prototype._projectLatlngs=function(points,...rest){projectedPoints+=points.length;return original.call(this,points,...rest)};
 w.L.Path.prototype.setStyle=function(options){styleWrites++;return style.call(this,options)};
 const t=performance.now();for(const z of [13,14,15,16,17,18,17,16,15,14,13,12]){m.setZoom(z,{animate:false});await wait(50)}
 results.push({dir,zoomTransitions:12,projectedPoints,styleWrites,elapsedMs:performance.now()-t,errors:a.errors});a.close();
}fs.writeFileSync(process.argv[3]||'/tmp/kpmap-zoom-benchmark.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exit(1)});
