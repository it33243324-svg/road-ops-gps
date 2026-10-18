const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const create=require('./app-harness.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 for(const [width,height] of [[390,844],[844,390],[1280,900]]){
  const app=await create('dist',{width,height}),w=app.window,map=app.map,D=w.eval('D');
  let passes=0;const original=w.eval('labels');w.__labels=()=>{passes++;original();};w.eval('labels=window.__labels');
  for(const [key,route]of Object.entries(D)){
   const f=route.facilities[Math.floor(route.facilities.length/2)];
   map.setView([f.lat,f.lng],16,{animate:false});await wait(50);
   const assertVisible=()=>{
    const markers=w.eval('[...facilityMarkers.values()]');
    for(const v of Object.values(D))for(const x of v.facilities)if(map.getBounds().contains([x.lat,x.lng]))
     assert(markers.some(m=>m.getLatLng().lat===x.lat&&m.getLatLng().lng===x.lng),'Visible facility missing after pan/zoom: '+x.name);
   };
   assertVisible();assert(w.document.querySelectorAll('.facility').length<135);
   const before=passes,marker=w.eval('facilityMarkers.values().next().value');
   for(let i=0;i<10;i++)map.fire('move');await wait(30);
   assert.equal(passes,before,'A contained viewport does not rescan KP rows on move');
   assert.equal(w.eval('facilityMarkers.values().next().value'),marker,'Unchanged facility marker is reused');
   for(let i=0;i<6;i++){map.panBy([width*.3,0],{animate:false});await wait(30);assertVisible();}
   map.setView([f.lat,f.lng],16,{animate:false});await wait(40);assertVisible();
   map.setZoom(10,{animate:false});await wait(40);assertVisible();
  }
  assert.deepEqual(app.errors,[]);app.close();
 }
 // Offscreen effects pause, and resume without stopping data services.
 let callback,visibility,unload,observed=[],paused=false,hidden=false;
 const root={classList:{toggle:(name,value)=>{hidden=value}}};
 const node={classList:{toggle:(name,value)=>{paused=value}}};
 const document={hidden:false,documentElement:root,head:{appendChild(){}},createElement:()=>({}),
  addEventListener:(name,fn)=>visibility=fn,removeEventListener(){},querySelectorAll:()=>[node]};
 vm.runInNewContext(fs.readFileSync('render-visibility.js','utf8'),{document,window:{IntersectionObserver:true},IntersectionObserver:class{constructor(fn){callback=fn}observe(n){observed.push(n)}disconnect(){}},map:{on:(name,fn)=>unload=fn}});
 assert.equal(observed.length,1);callback([{target:node,isIntersecting:false}]);assert(paused);
 callback([{target:node,isIntersecting:true}]);assert(!paused);
 document.hidden=true;visibility();assert(hidden);document.hidden=false;visibility();assert(!hidden);unload();
 console.log('PASS: phone/landscape/desktop viewport culling, edge continuity, marker reuse, KP scan avoidance, animation pause/resume');
}
main().catch(e=>{console.error(e);process.exit(1)});
