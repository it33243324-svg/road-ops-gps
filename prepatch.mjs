import fs from 'fs';
const p='build.mjs';
let s=fs.readFileSync(p,'utf8');
const old=`// 広島岩国道路はE2山陽道と同一路面を通るため、山陽道の高精度固定線形から廿日市〜大竹区間を抽出する。
if(DATA.sanyo?.segs?.length&&DATA.hiroshima_iwakuni){const hi=[];for(const seg of DATA.sanyo.segs){const pts=seg.filter(p=>p[0]>=34.235&&p[0]<=34.365&&p[1]>=132.205&&p[1]<=132.345);if(pts.length>1)hi.push(pts)}if(hi.length){DATA.hiroshima_iwakuni.segs=hi;DATA.hiroshima_iwakuni.quality='official-derived'}}`;
const neu=`// OSM道路中心線に合わせて廿日市IC〜廿日市JCTの線形を修正。山陽道と重なる区間は二重描画しない。
if(DATA.hiroshima_iwakuni){
 const line=[[34.3451588,132.3131984],[34.3451267,132.3121834],[34.3451106,132.3116759],[34.3450769,132.3105652],[34.3450635,132.3102579],[34.344812,132.308439],[34.3443762,132.306996],[34.3434756,132.3051443],[34.3388148,132.2984286],[34.3364604,132.2958663],[34.3362869,132.2949904],[34.3367262,132.2942577],[34.336845,132.294527]];
 // KPの基準はJCT分岐点から料金所まで。接続ランプと営業距離2.5kmを混ぜない。
 const kpLine=line.slice(0,9),c=cum(kpLine),total=c.at(-1);
 DATA.hiroshima_iwakuni.segs=[line];DATA.hiroshima_iwakuni.marks=[];
 for(let k=0;k<=1.5+1e-8;k+=.1){const p=at(kpLine,c,(1-k/1.5)*total);DATA.hiroshima_iwakuni.marks.push([+k.toFixed(1),+p[0].toFixed(6),+p[1].toFixed(6)])}
 // 現地KPは廿日市JCTが0、廿日市IC側へ増加。営業距離の起点とは逆向き。
 DATA.hiroshima_iwakuni.kpCalibration={start:0,end:1.5,method:'reference-point-interpolation',reference:'廿日市JCT分岐点〜廿日市料金所（約1.5KP）'};
 DATA.hiroshima_iwakuni.quality='osm-road-aligned';
}`;
if(!s.includes(old)) throw new Error('target patch block not found');s=s.replace(old,neu);
const dataAnchor="if(!DATA.chugoku||DATA.chugoku.marks.length<2)throw Error('中国道KP固定データの生成に失敗しました');";
const keep=`DATA.chugoku.color='#ec5bb4';
const KEEP=new Set(Object.keys(DATA));
`;
if(!s.includes(dataAnchor)) throw new Error('DATA filter anchor not found');s=s.replace(dataAnchor,keep+dataAnchor);
const oldKeys="keys=[...new Set(['sanyo','chugoku',r.value])]";if(!s.includes(oldKeys)) throw new Error('KP label selection block not found');s=s.replace(oldKeys,"keys=['sanyo','chugoku','hiroshima','hiroshima_iwakuni']");
const routeFilter="['sanyo','chugoku','hiroshima','hiroshima_iwakuni'].includes(k)";
const roadDraw="for(const v of Object.values(D))for(const s of v.segs){L.polyline(s,{color:'#061219',weight:9,opacity:.88,interactive:false}).addTo(roads);L.polyline(s,{color:v.color,weight:5,opacity:.98,interactive:false}).addTo(roads)}";
const roadDrawNew="for(const [k,v] of Object.entries(D))if(['sanyo','chugoku','hiroshima','hiroshima_iwakuni'].includes(k))for(const s of v.segs){L.polyline(s,{color:'#061219',weight:9,opacity:.88,interactive:false}).addTo(roads);L.polyline(s,{color:v.color,weight:5,opacity:.98,interactive:false}).addTo(roads)}";
if(!s.includes(roadDraw)) throw new Error('road draw block not found');s=s.replace(roadDraw,roadDrawNew);

const selectAnchor="Object.entries(D).forEach(([k,v])=>r.add";
if(!s.includes(selectAnchor)) throw new Error('route selector block not found');s=s.replace(selectAnchor,"Object.entries(D).filter(([k])=>"+routeFilter+").forEach(([k,v])=>r.add");
const legendAnchor="legend.innerHTML=Object.entries(D).map";
if(!s.includes(legendAnchor)) throw new Error('route legend block not found');s=s.replace(legendAnchor,"legend.innerHTML=Object.entries(D).filter(([k])=>"+routeFilter+").map");

const oldStep="function step(){let z=map.getZoom();return z>=15?.1:z>=13?.5:z>=11?1:5}";if(!s.includes(oldStep)) throw new Error('zoom density block not found');s=s.replace(oldStep,"function step(){let z=map.getZoom();return z>=17?.1:z>=15?.5:z>=13?1:z>=12?2:z>=11?5:10}");
const oldCount="kc.textContent=(D.sanyo?.marks?.length||0)+(D.chugoku?.marks?.length||0);msg.textContent='山陽道・中国道KP：広域=5.0km / 1.0km / 0.5km / 0.1km ・ 表示 '+n+'件'";
const newCount="kc.textContent=Object.values(D).reduce((a,v)=>a+(v.marks?.length||0),0);msg.textContent='4路線KP：広域=10km / 5km / 2km / 1.0km / 0.5km / 0.1km ・ 表示 '+n+'件'";if(!s.includes(oldCount)) throw new Error('KP count/message block not found');s=s.replace(oldCount,newCount);
const oldHtml="html='<div class=\"kpmark '+side+' '+rank+'\"><span class=\"kpstem\"></span><span class=\"kplabel\"><b>'+x[0].toFixed(1)+'</b><small>KP</small></span></div>'";
const newHtml="html='<div class=\"kpmark '+side+' '+rank+'\" style=\"--route:'+v.color+'\"><span class=\"kpstem\"></span><span class=\"kplabel\" onclick=\"pickKp('+x[1]+','+x[2]+','+x[0]+',this);event.stopPropagation()\"><b>'+x[0].toFixed(1)+'</b><small>KP</small></span></div>'";if(!s.includes(oldHtml)) throw new Error('KP label html block not found');s=s.replace(oldHtml,newHtml);
const styleAnchor='.kpmark.major .kplabel{font-size:13px;padding:4px 9px;background:#505a64;border-color:#fff}';
const styleNew='.kpmark.major .kplabel{font-size:13px;padding:4px 9px;background:#fff;border-color:var(--route);color:var(--route)}.kpmark .kplabel{background:#fff;border-color:var(--route);color:var(--route);pointer-events:auto;cursor:pointer}.kpmark .kpstem{background:var(--route);box-shadow:0 0 0 1px #00101855}.kplabel.picked{box-shadow:0 0 0 3px #fff,0 2px 8px #000b}';if(!s.includes(styleAnchor)) throw new Error('KP label style block not found');s=s.replace(styleAnchor,styleNew);
const statusBadges='<span class=tag>道路DATA <b class=ok>FIXED</b></span><span class=tag>高精度 <b>${exact}/19</b></span><span class=tag>KP <b id=kc>0</b></span>';if(!s.includes(statusBadges)) throw new Error('status badges block not found');s=s.replace(statusBadges,'<span id=kc style="display:none">0</span>');
if(!s.includes('<button id=all>中国地方</button>')) throw new Error('region button not found');s=s.replace('<button id=all>中国地方</button>','<button id=loc>現在地</button>');
const vars="r=$('r'),q=$('q'),go=$('go'),all=$('all'),legend=$('legend'),kc=$('kc'),msg=$('msg');";
const varsNew="r=$('r'),q=$('q'),go=$('go'),loc=$('loc'),gmap=$('gmap'),legend=$('legend'),kc=$('kc'),msg=$('msg'),here=L.layerGroup().addTo(map);";if(!s.includes(vars)) throw new Error('button vars block not found');s=s.replace(vars,varsNew);
if(!s.includes("all.onclick=()=>map.fitBounds(B);")) throw new Error('region button handler not found');s=s.replace("all.onclick=()=>map.fitBounds(B);","");
const mapOptions="maxBoundsViscosity:.8}";
if(!s.includes(mapOptions)) throw new Error('map options not found');s=s.replace(mapOptions,"maxBoundsViscosity:.8,zoomSnap:.1}");
const startup="drawAll();drawSelected(false);";
const defaultView="function setDefaultView(point){const size=map.getSize(),pixels=Math.max(size.x,size.y),zoom=Math.log2(40075016.686*Math.cos(point[0]*Math.PI/180)*pixels/(256*9000));map.setView(point,Math.round(zoom*10)/10-2)}setDefaultView([34.46,132.412]);drawAll();drawSelected(false);";
if(!s.includes(startup)) throw new Error('map startup not found');s=s.replace(startup,defaultView);
if(!s.includes('<button id=loc>現在地</button>')) throw new Error('current location button not found after patch');s=s.replace('<button id=loc>現在地</button>','');
if(!s.includes('<div id=legend class=legend>')) throw new Error('legend row not found');s=s.replace('<div id=legend class=legend>','<div class=mapactions><button id=loc>現在地</button><button id=gmap disabled>Google Map</button></div><div id=legend class=legend>');
if(!s.includes('</style></head>')) throw new Error('style close not found');s=s.replace('</style></head>','.mapactions{display:flex;gap:6px;margin:6px 0}.mapactions button:disabled{opacity:.45}.leaflet-control-zoom a{width:42px!important;height:42px!important;line-height:42px!important;font-size:27px!important}.leaflet-control-zoom{border-radius:9px!important;overflow:hidden}</style></head>');
const tileAnchor=";L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);";
const picker=";let pickedKp=null;function pickKp(lat,lng,k,el){pickedKp=[lat,lng,k];document.querySelectorAll('.kplabel.picked').forEach(x=>x.classList.remove('picked'));el.classList.add('picked');gmap.disabled=false;msg.textContent=Number(k).toFixed(1)+'KP を選択しました'}gmap.onclick=()=>{if(!pickedKp)return;const [lat,lng]=pickedKp;window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lng),'_blank','noopener')};L.tileLayer('https://tile.openstreetmap.jp/styles/maptiler-basic-ja/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);";
if(!s.includes(tileAnchor)) throw new Error('tile layer anchor not found');s=s.replace(tileAnchor,picker);
if(!s.includes('<title>KPMAP</title>'))s=s.replace('<title>ROAD OPS</title>','<title>KPMAP</title>');
if(!s.includes('<b>KPMAP // CHUGOKU</b>'))s=s.replace('<b>ROAD OPS // CHUGOKU</b>','<b>KPMAP // CHUGOKU</b>');
s=s.replace('<b>KPMAP // CHUGOKU</b>','');
s=s.replace("v.name+' '+v.code",'v.name');
s=s.replace('function drawSelected(fit=false){',"function drawSelected(fit=false){r.style.color=D[r.value].color;r.style.borderColor=D[r.value].color;r.style.fontWeight='900';Array.from(r.options).forEach(o=>{o.style.color=D[o.value].color});");
fs.writeFileSync(p,s);
console.log('Set KPMAP branding and Japanese color basemap');
console.log('Kept all existing lat/lng geometry and map projection');

