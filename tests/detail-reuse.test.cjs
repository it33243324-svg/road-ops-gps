const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function render(source){
 let frames=[],created=0,reads=0,writes=0,shift=0,zoom=15,shown=true;const layers=new Set(),handlers={},panes={};
 const items=Array.from({length:80},(_,i)=>({type:i%2?'tunnel':'bridge',name:'item'+i,point:[80+(i%8)*53,80+Math.floor(i/8)*60],path:[[80+(i%8)*53,70+Math.floor(i/8)*60],[80+(i%8)*53,90+Math.floor(i/8)*60]]}));
 const rects=Array.from({length:120},(_,i)=>({left:(i%12)*65,right:(i%12)*65+60,top:Math.floor(i/12)*55,bottom:Math.floor(i/12)*55+20,width:60,height:20}));
 const map={createPane:n=>panes[n]={style:{}},getPane:n=>n==='markerPane'?{parentElement:{appendChild(){}}}:panes[n],distance:()=>1000,getZoom:()=>zoom,getBounds:()=>({pad(){return this},contains:()=>shown}),getContainer:()=>({getBoundingClientRect:()=>({left:0,right:800,top:0,bottom:600}),querySelectorAll:()=>rects.map(r=>({getBoundingClientRect:()=>r}))}),latLngToContainerPoint:p=>({x:p[1]+shift,y:p[0]}),containerPointToLatLng:p=>[p.y,p.x-shift],on:(name,fn)=>handlers[name]=fn};
 const L={point:(x,y)=>({x,y}),layerGroup:()=>({addTo(){return this},clearLayers(){layers.clear()},removeLayer(m){layers.delete(m)}}),divIcon:o=>o,marker:(p,o)=>{created++;const m={p:[...p],title:o.icon.html.match(/title="([^"]+)/)[1],getElement:()=>({querySelector:()=>({style:{setProperty(){}},classList:{toggle(){}},getBoundingClientRect:()=>{reads++;const p=map.latLngToContainerPoint(m.p);return{left:p.x-30,right:p.x+30,top:p.y-6,bottom:p.y+6,width:60,height:12}}})}),addTo(){layers.add(this);return this},setLatLng(p){writes++;this.p=p;return this}};return m}};
 vm.runInNewContext(source,{map,L,D:{sanyo:{}},window:{KPMAP_TRAFFIC_LANDMARKS:{routes:{sanyo:items}}},MutationObserver:class{observe(){}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length}});
 const snapshots=[];const snapshot=()=>[...layers].map(m=>[m.title,...m.p]).sort((a,b)=>a[0].localeCompare(b[0]));snapshots.push(snapshot());
 const redraw=()=>{handlers['moveend zoomend rotate']();frames.splice(0).forEach(f=>f());snapshots.push(snapshot());};
 for(let i=0;i<20;i++){shift=i*3;redraw();}
 shown=false;redraw();assert.equal(layers.size,0);shown=true;redraw();assert.equal(layers.size,80);
 zoom=10;redraw();assert.equal(layers.size,0);zoom=15;redraw();assert.equal(layers.size,80);
 return{snapshots,created,reads,writes};
}
const current=render(fs.readFileSync('map-details.js','utf8'));
if(process.argv[2]){const before=render(fs.readFileSync(process.argv[2],'utf8'));assert.deepEqual(current.snapshots,before.snapshots,'Every chosen detail-label position remains identical');console.log('Detail marker creations: '+before.created+' -> '+current.created+'; identical positions across dense redraw/cull/zoom scenarios');}
assert(current.created<=240,'Visible markers are reused until removed from view or zoomed out');console.log('PASS: dense detail-label marker reuse and viewport removal/reappearance');
