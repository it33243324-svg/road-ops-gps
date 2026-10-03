// Run after npm run build. Uses real traffic records; GPS motion is test-only input.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const dist=path.resolve(process.argv[2]||'dist');
const leaflet=process.env.KPMAP_TEST_LEAFLET||require.resolve('leaflet/dist/leaflet.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/traffic-2026-10-03.json')));
let gpsCallback,gpsError,gpsOptions,fetches=0,failFetch=false,intervals=[],errors=[],now=Date.now();
class Resources extends ResourceLoader {
 fetch(url) {
  if(url.includes('/leaflet@1.9.4/dist/leaflet.js'))return Promise.resolve(fs.readFileSync(leaflet));
  if(url.startsWith('https://kpmap.test/')){
   const local=path.join(dist,new URL(url).pathname);
   if(fs.existsSync(local))return Promise.resolve(fs.readFileSync(local));
  }
  return null;
 }
}
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.detail?.stack||e.message));vc.on('error',(...args)=>{if(!failFetch)errors.push(args.join(' '));});
const dom=new JSDOM(fs.readFileSync(path.join(dist,'index.html'),'utf8'),{url:'https://kpmap.test/',runScripts:'dangerously',resources:new Resources(),pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.Date.now=()=>now;
 Object.defineProperties(w.HTMLElement.prototype,{clientWidth:{get(){return this.id==='m'?1280:1280;}},clientHeight:{get(){return this.id==='m'?(this.classList.contains('map-fullscreen')?900:640):900;}}});
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({canvas:this},{get:(o,k)=>k in o?o[k]:()=>{}});};
 w.fetch=async()=>{fetches++;if(failFetch)throw new Error('test offline');return {ok:true,json:async()=>JSON.parse(JSON.stringify(fixture))};};
 w.navigator.geolocation={watchPosition(callback,error,options){gpsCallback=callback;gpsError=error;gpsOptions=options;return 1;},clearWatch(){}};
 w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length;};
 Object.defineProperty(w.document,'hidden',{get:()=>false});
}});
const w=dom.window,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<100;i++){if(check())return;await wait(20);}throw new Error('Timed out: '+label);}
function gps(lat,lon,speed,heading,accuracy=8){now+=1000;gpsCallback({timestamp:now,coords:{latitude:lat,longitude:lon,speed,heading,accuracy}});}
async function main(){
 await until(()=>w.document.querySelector('.map-tool')&&w.document.querySelector('.traffic-event-marker'),'scripts');
 const doc=w.document,map=w.eval('map');
 assert.deepEqual(errors,[]);
 assert.equal(doc.querySelector('#q').value,'');
 assert.equal(doc.querySelector('#gmap').disabled,true);
 assert.equal(doc.querySelector('#trafficRadius').value,'20');
 assert.equal(doc.querySelectorAll('.traffic-event-marker').length,42,'Every real event needs its own marker');
 assert.equal(doc.querySelectorAll('.traffic-cluster-count').length,0,'Clusters must be removed');
 assert.equal(doc.querySelectorAll('.facility').length,135,'Existing four-route facility labels must remain');
 assert(doc.querySelector('#trafficUpdated').textContent.includes('更新（取得時刻）'));
 assert.equal(doc.querySelectorAll('.traffic-age').length,0,'Fetch time must never be displayed as event age');
 assert(gpsOptions.enableHighAccuracy&&gpsOptions.maximumAge===0);
 const panes=doc.querySelectorAll('[class*="traffic-priority"]');
 const tools=[...doc.querySelectorAll('.map-tool')];assert.equal(tools.length,3);
 assert(tools[0].title.includes('全画面')&&tools[1].title.includes('追いかけ')&&tools[2].title.includes('進行方向'));
 gps(34.4557,132.721,1,180);
 assert.equal(w.KPMAPLocation.getLatest().heading,null,'Walking must not determine direction');
 const nearbyText=doc.querySelector('#trafficCount').textContent;
 assert(nearbyText.startsWith('2件'),'Nearby traffic radius must still work');
 assert(doc.querySelector('.traffic-regulation-group'));
 tools[1].click();
 assert.equal(tools[1].getAttribute('aria-pressed'),'true');
 gps(34.4557,132.72101,1,270);
 assert.equal(w.KPMAPLocation.getLatest().heading,null);
 assert(Math.abs(map.getCenter().lat-34.4557)<.0001,'Follow should center on GPS');
 tools[2].click();
 gps(34.4557,132.72112,10,90);
 assert.equal(w.KPMAPLocation.getLatest().heading,null,'One vehicle sample must not be sufficient');
 gps(34.4557,132.72123,10,90);
 assert.equal(w.KPMAPLocation.getLatest().heading,90);
 await wait(1200);
 assert(Math.abs(map.getBearing()-270)<2,'Eastbound heading must rotate north to the left');
 const center=map.latLngToContainerPoint(map.getCenter());
 const east=map.latLngToContainerPoint([map.getCenter().lat,map.getCenter().lng+.001]);
 assert(east.y<center.y&&Math.abs(east.x-center.x)<4,'East should render at the top');
 const kp=doc.querySelector('.kplabel');kp.click();
 assert(w.eval('pickedKp')&&doc.querySelector('#gmap').disabled===false,'KP click and Google Map action must survive rotation');
 const input=doc.querySelector('#q');input.value='292';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(doc.querySelector('#go').disabled,false);
 doc.querySelector('#go').click();
 assert.equal(w.eval('pickedKp')[2],292);
 assert.equal(map.getZoom(),12,'Existing KP jump zoom must remain unchanged');
 assert.equal(tools[1].getAttribute('aria-pressed'),'false','KP jump must stop following');
 tools[2].click();assert.equal(map.getBearing(),0,'North-up switch must work');
 tools[0].click();await wait(80);
 assert(doc.querySelector('#m').classList.contains('map-fullscreen'));
 assert(doc.body.classList.contains('kpmap-fullscreen-open'));
 assert.equal(doc.querySelector('.map-fullscreen-action button').disabled,false,'Google Map remains available in fullscreen');
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));await wait(80);
 assert(!doc.querySelector('#m').classList.contains('map-fullscreen'));
 tools[1].click();map.fire('dragstart');assert.equal(tools[1].getAttribute('aria-pressed'),'false','Manual pan stops following');
 const oldTime=doc.querySelector('#trafficUpdated').dateTime;
 failFetch=true;doc.querySelector('#trafficRefresh').click();await wait(30);
 assert.equal(doc.querySelectorAll('.traffic-event-marker').length,42,'Failed update preserves all old traffic markers');
 assert.equal(doc.querySelector('#trafficUpdated').dateTime,oldTime,'Failed update must not claim a fresh timestamp');
 assert(doc.querySelector('#trafficUpdated').classList.contains('is-stale'));
 failFetch=false;
 const auto=intervals.find(x=>x.ms===300000);assert(auto);await auto.fn();await wait(30);
 assert(!doc.querySelector('#trafficUpdated').classList.contains('is-stale'));
 assert(fetches>=3,'Initial, manual and automatic requests must run');
 assert.deepEqual(errors,[]);
 console.log('PASS: complete real-data page, individual markers, existing KP/Google/facility controls, GPS walk/vehicle rules, heading projection, follow/pan, fullscreen fallback and refresh failure recovery');
 dom.window.close();
}
main().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
