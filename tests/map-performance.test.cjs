const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function render(source){
 let reads=0,writes=0,frames=[];const layers=[],panes={},handlers={};
 const point=(x,y)=>({x,y});let marker;
 const map={createPane:n=>panes[n]={style:{}},getPane:n=>n==='markerPane'?{parentElement:{appendChild(){}}}:panes[n],distance:()=>1000,getZoom:()=>14,getBounds:()=>({pad(){return this},contains:()=>true}),getContainer:()=>({getBoundingClientRect:()=>({left:0,right:800,top:0,bottom:600}),querySelectorAll:()=>[]}),latLngToContainerPoint:p=>point(p[1],p[0]),containerPointToLatLng:p=>[p.y,p.x],on:(name,fn)=>{handlers[name]=fn}};
 const L={point,layerGroup:()=>({addTo(){return this},clearLayers(){layers.length=0}}),divIcon:o=>o,marker:(p,o)=>{const m={p:[...p],getElement:()=>({querySelector:()=>({getBoundingClientRect:()=>{reads++;return {left:m.p[1]-30,right:m.p[1]+30,top:m.p[0]-6,bottom:m.p[0]+6,width:60,height:12}}})}),addTo(){layers.push(this);marker=this;return this},setLatLng(p){writes++;this.p=p;return this}};return m}};
 const ctx={map,L,D:{sanyo:{segs:[[[200,200],[200,400]]]}},window:{KPMAP_TRAFFIC_LANDMARKS:{routes:{sanyo:[{type:'tunnel',name:'test',point:[200,300]}]}}},MutationObserver:class{observe(){}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length}};
 vm.runInNewContext(source,ctx);const initial={reads,writes,p:marker.p};handlers['moveend zoomend rotate']();frames.splice(0).forEach(f=>f());return {initial,after:{reads,writes,p:marker.p}};
}
const optimized=render(fs.readFileSync('map-details.js','utf8'));
assert.equal(optimized.initial.reads,1,'One layout read per detail label');assert.equal(optimized.initial.writes,1,'Only final chosen marker position is written');assert.equal(optimized.after.reads,2,'One further layout read on redraw');assert.deepEqual(optimized.initial.p,[205,300],'Original nearest offset preserved');
if(process.argv[2]){const before=render(fs.readFileSync(process.argv[2],'utf8'));assert.deepEqual(optimized.initial.p,before.initial.p);console.log(`Detail-label layout reads: ${before.initial.reads} -> ${optimized.initial.reads}; marker position writes: ${before.initial.writes} -> ${optimized.initial.writes}`);}
console.log('PASS: detail placement keeps the chosen position with one layout read and one final write.');
