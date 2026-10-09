const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
let frames = [], events = {}, projections = 0, drawAlpha = [], clips = [], images = 0;
let rects = [{left:120,top:70,right:180,bottom:90,width:60,height:20},
  {left:130,top:70,right:190,bottom:90,width:60,height:20}];
const context = () => ({setTransform(){},clearRect(){},save(){},restore(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){},rect(...args){clips.push(args)},clip(){},
  drawImage(){images++;drawAlpha.push(this.globalAlpha)}});
const elements = [], document = {createElement(){const e={style:{},setAttribute(){},remove(){},getContext:context};elements.push(e);return e}};
const container = {appendChild(){},getBoundingClientRect:()=>({left:100,top:50,right:500,bottom:350,width:400,height:300}),querySelectorAll:()=>rects.map(rect=>({getBoundingClientRect:()=>rect}))};
const line = color => ({options:{color,weight:14},getLatLngs:()=>[{lat:1,lng:2},{lat:3,lng:4}]});
const group = {eachLayer(fn){[line('#2385ff'),line('#fff')].forEach(fn)},on(){}};
const map = {getContainer:()=>container,getSize:()=>({x:400,y:300}),latLngToContainerPoint(p){projections++;return{x:p.lng,y:p.lat}},on(names,fn){for(const n of names.split(' '))events[n]=fn}};
vm.runInNewContext(fs.readFileSync('road-label-overlap.js','utf8'),{map,document,roads:group,sel:group,D:{sanyo:{color:'#2385ff'}},r:{addEventListener(){}},window:{devicePixelRatio:2},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame(fn){frames.push(fn);return frames.length},cancelAnimationFrame(){}});
const flush = () => {const pending=frames;frames=[];pending.forEach(fn=>fn())};
flush();
assert.equal(elements[0].style.pointerEvents,'none','Overlay does not block labels');
assert.equal(elements[0].style.zIndex,'900');
assert.equal(elements[0].width,800,'DPR-scaled canvas');
assert.equal(images,1,'One composite even with overlapping labels and selected road');
assert.equal(drawAlpha[0],.3,'70% transparency equals 30% opacity');
assert.deepEqual(clips[0],[40,40,120,40],'Clip is limited to the covered label rectangle');
events.movestart();assert.equal(elements[0].hidden,true,'Hide stale projected strokes while moving');
events.moveend();flush();assert.equal(elements[0].hidden,false);
rects=[];const before=images;events.zoomend();flush();assert.equal(images,before,'No covered labels means no foreground road');
assert(projections>0);console.log('PASS: overlap-only clip, exact 70% transparency, pointer passthrough, movement and DPR');
