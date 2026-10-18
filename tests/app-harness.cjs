const fs=require('node:fs'),path=require('node:path');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
module.exports=async function createHarness(directory,options={}){
  const dist=path.resolve(directory),fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/traffic-2026-10-03.json')));
  const state={now:Date.now(),hidden:false,width:options.width||1280,height:options.height||900,
    offline:false,fetches:0,errors:[],intervals:[],strokeCalls:0,images:0,callback:null,feed:fixture,
    watchStarts:0,watchClears:0,watchActive:false,openedUrls:[]};
  class Resources extends ResourceLoader{
    fetch(url){
      if(url.includes('/leaflet@1.9.4/dist/leaflet.js'))return Promise.resolve(fs.readFileSync(require.resolve('leaflet/dist/leaflet.js')));
      if(url.startsWith('https://kpmap.test/')){const file=path.join(dist,new URL(url).pathname);if(fs.existsSync(file))return Promise.resolve(fs.readFileSync(file));}
      return null;
    }
  }
  const vc=new VirtualConsole();
  vc.on('jsdomError',e=>state.errors.push(e.detail?.stack||e.message));
  vc.on('error',(...args)=>{if(!state.offline&&!state.expectedNetworkError)state.errors.push(args.join(' '));});
  const dom=new JSDOM(fs.readFileSync(path.join(dist,'index.html'),'utf8'),{url:'https://kpmap.test/',runScripts:'dangerously',resources:new Resources(),pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.Date.now=()=>state.now;
    const nativeTimeout=w.setTimeout.bind(w);
    w.setTimeout=(fn,ms,...args)=>{if(ms===20000&&state.captureTimeout)state.abortTimeout=fn;return nativeTimeout(fn,ms,...args);};
    Object.defineProperties(w.HTMLElement.prototype,{clientWidth:{get(){return state.width;}},clientHeight:{get(){return this.id==='m'?Math.round(state.height*.7):state.height;}}});
    w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({canvas:this,stroke(){state.strokeCalls++;},drawImage(){state.images++;}},{get:(o,k)=>k in o?o[k]:()=>{}});};
    w.fetch=async(url,options={})=>{state.fetches++;if(state.offline)throw Error('test offline');
      if(state.stallNetwork){state.abortSignal=options.signal;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('test aborted')),{once:true}));}
      return {ok:true,json:async()=>JSON.parse(JSON.stringify(state.feed))};};
    w.navigator.geolocation={watchPosition(cb,error){state.watchStarts++;state.watchActive=true;state.callback=cb;state.gpsError=error;return state.watchStarts;},clearWatch(){state.watchClears++;state.watchActive=false;}};
    w.open=(...args)=>state.openedUrls.push(args);
    w.setInterval=(fn,ms)=>{state.intervals.push({fn,ms});return state.intervals.length;};
    Object.defineProperty(w.document,'hidden',{get:()=>state.hidden});
  }});
  const w=dom.window,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(let i=0;i<200&&(!state.callback||!w.document.querySelector('.map-tool'));i++)await wait(10);
  if(!state.callback)throw Error('GPS client failed to initialize');
  await wait(50);
  state.window=w;state.map=w.eval('map');state.dom=dom;
  state.gps=(point,heading=90,speed=25,accuracy=8)=>state.watchActive && state.callback({timestamp:state.now,coords:{latitude:point[0],longitude:point[1],heading,speed,accuracy}});
  state.summary=()=>['locationRoad','locationKp','locationDirection'].map(id=>w.document.getElementById(id).textContent);
  state.minute=async()=>{
    await Promise.all(state.intervals.filter(x=>x.ms===60000).map(x=>x.fn()));
    // Timer callbacks may launch an async load without returning its promise.
    for(let i=0;i<200&&w.document.querySelector('#trafficRefresh').disabled;i++)await wait(5);
    if(w.document.querySelector('#trafficRefresh').disabled)throw Error('Traffic refresh did not settle');
  };
  state.close=()=>dom.window.close();
  return state;
};
