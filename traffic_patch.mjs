import fs from 'node:fs';

const file = 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');
const styleAnchor = '.mapactions{display:flex;gap:6px;margin:6px 0}';
const styles = [
  '#m{height:62vh;min-height:360px}',
  '.location-panel{margin:8px 0 10px;padding:14px 16px;border:1px solid #31505c;border-radius:14px;background:linear-gradient(135deg,#102b36,#081a21);box-shadow:0 6px 18px #00101855}',
  '.location-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.location-title{font-size:18px;font-weight:900;letter-spacing:.02em}.location-status{padding:4px 9px;border-radius:999px;background:#203b45;color:#c4d7df;font-size:13px;font-weight:750}.location-status.ready{background:#153d35;color:#8dffcc}.location-road-label,.location-stat-label{display:block;color:#a9c1ca;font-size:14px;font-weight:700}.location-road-name{display:block;margin-top:2px;color:#fff;font-size:clamp(22px,5vw,30px);font-weight:950;line-height:1.25;overflow-wrap:anywhere}.location-values{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.location-value{padding:10px 12px;border:1px solid #294651;border-radius:10px;background:#0a2028}.location-value strong{display:block;margin-top:3px;color:#fff;font-size:clamp(22px,5vw,30px);font-weight:950;line-height:1.2}.location-value.kp strong{font-size:clamp(28px,6vw,38px);color:#95f5c7}.location-note{margin:10px 0 0;color:#b3c7ce;font-size:13px;line-height:1.5}',
  '.traffic{margin:8px 0 10px;border:1px solid #29434d;border-radius:12px;background:#081920;overflow:hidden}',
  '.traffic-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:9px 10px;background:#0c222b}',
  '.traffic-head strong{font-size:13px}.traffic-count{color:#7dffad;font-weight:800}',
  '.traffic-meta{color:#a9c1ca;font-size:11px;flex:1}.traffic-head button{padding:5px 9px}.traffic-radius{display:flex;gap:4px;align-items:center;color:#bcd0d7;font-size:10px}.traffic-radius select{padding:5px}',
  '.traffic-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:6px;padding:7px;max-height:42vh;overflow:auto}',
  '.traffic-card{border:1px solid #263e48;border-left:3px solid #f0ae48;border-radius:8px;padding:7px 8px;background:#0d2028;min-width:0;cursor:pointer}',
  '.traffic-card:hover{background:#15313c;border-color:#54717c}',
  '.traffic-card[data-type="closed"],.traffic-card[data-type="accident"],.traffic-card[data-type="broken"]{border-left-color:#ff5c64}',
  '.traffic-card[data-type="oneLane"],.traffic-card[data-type="laneRestriction"],.traffic-card[data-type="underRegulation"]{border-left-color:#ffb547}',
  '.traffic-loc{font-size:13px;font-weight:850;line-height:1.4;overflow-wrap:anywhere}',
  '.traffic-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;color:#bfd0d6}.traffic-tag{padding:2px 5px;border-radius:999px;background:#19313b;font-size:10px}',
  '.traffic-empty{padding:12px;color:#bdd0d6}.traffic-error{color:#ff9c9c}',
  '.traffic-pin{width:32px;height:32px;box-sizing:border-box;position:relative;display:flex;align-items:center;justify-content:center;background:#fff000;border:2px solid #283000;border-radius:6px;box-shadow:0 0 0 2px #fff000;color:#101910;font-size:25px;font-weight:950;line-height:1;filter:drop-shadow(0 2px 3px #00101877)}',
  '.traffic-pin svg{width:25px;height:25px}.traffic-pin.warning{border:3px solid #ff4938;color:#f23d26}.traffic-pin.multi{width:36px;height:36px}.traffic-cluster-symbol svg{width:23px;height:23px}.traffic-cluster-count{position:absolute;right:-8px;bottom:-8px;border-radius:10px;padding:3px 5px;background:#18343d;color:white;border:2px solid white;font-size:11px;line-height:1}',
  '.traffic-key{display:flex;gap:12px;flex-wrap:wrap;padding:7px 10px;border-top:1px solid #29434d;color:#c4d7df;font-size:11px}.traffic-key span{display:inline-flex;align-items:center;gap:5px}.traffic-key-line{width:23px;height:6px;border-radius:2px;background:#8aca00}.traffic-key-sign{background:#fff000;color:#161c0b;padding:1px 4px;border:1px solid #242900;border-radius:3px;font-style:normal;font-weight:900}.traffic-key-sign.warning{color:#ff4938;border:2px solid #ff4938}',
  '@media(max-width:600px){#m{height:58vh;min-height:320px}.location-panel{padding:12px}.location-values{gap:7px}.location-value{padding:9px}.location-note{font-size:13px}.traffic-list{max-height:34vh}.traffic-head{gap:6px}.traffic-meta{flex-basis:100%}}'
].join('');
if (!html.includes(styleAnchor)) throw new Error('traffic style anchor not found');
html = html.replace(styleAnchor, styles + styleAnchor);

const mapAnchor = '<div id=m></div>';
const panel = '<section class="traffic" aria-label="中国地方の交通情報"><div class="traffic-head"><strong>🚧 交通情報 <span class="traffic-count" id="trafficCount">読込中</span></strong><span class="traffic-meta" id="trafficMeta">地図には全件表示 ・ 一覧は現在地から25km以内</span><label class="traffic-radius">範囲 <select id="trafficRadius"><option value="20">20km</option><option value="25" selected>25km</option><option value="50">50km</option><option value="100">100km</option></select></label><button id="trafficRefresh" type="button">更新</button></div><div class="traffic-key" aria-label="交通情報の凡例"><span><i class="traffic-key-sign">↗</i>規制</span><span><i class="traffic-key-sign warning">!</i>事故・故障車・落下物</span></div><div class="traffic-list" id="trafficList"><div class="traffic-empty">現在地を取得すると周辺の詳細が表示されます。</div></div></section>';
if (!html.includes(mapAnchor)) throw new Error('traffic panel insertion point not found');
const locationPanel = '<section class="location-panel" id="locationPanel" aria-label="現在地の道路情報"><div class="location-head"><div class="location-title">現在地の道路情報</div><span class="location-status" id="locationStatus">未取得</span></div><div><span class="location-road-label">道路名</span><strong class="location-road-name" id="locationRoad">位置情報を確認しています</strong></div><div class="location-values"><div class="location-value"><span class="location-stat-label">上り・下り</span><strong id="locationDirection">—</strong></div><div class="location-value kp"><span class="location-stat-label">最寄りKP</span><strong id="locationKp">—</strong></div></div><p class="location-note" id="locationNote">移動中は進行方向から判定し、停車中は直前の移動軌跡を使います。</p></section>';
if (!html.includes('id="locationPanel"')) html = html.replace(mapAnchor, mapAnchor + locationPanel + panel);
const scriptAnchor = '</body>';
if (!html.includes(scriptAnchor)) throw new Error('traffic script insertion point not found');
html = html.replace(scriptAnchor, '<script src="/traffic-client.js"></script><script src="/location-client.js"></script><script src="/location-ui.js"></script>' + scriptAnchor);
fs.copyFileSync('traffic-client.js', 'dist/traffic-client.js');
fs.copyFileSync('location-client.js', 'dist/location-client.js');
fs.copyFileSync('location-ui.js', 'dist/location-ui.js');
// Reuse KP markers and preload overlays outside the viewport.
html = html.replace('maxBoundsViscosity:.8,zoomSnap:.1', 'maxBoundsViscosity:.8,zoomSnap:.1,preferCanvas:true,renderer:L.canvas({padding:.5})');
// Labels sit above restriction canvases; only their buttons capture input.
html = html.replace('function pickKp(', "map.createPane('kpPane');map.getPane('kpPane').style.zIndex='640';map.getPane('kpPane').style.pointerEvents='none';function pickKp(");
html = html.replace('</style>', '.leaflet-kp-pane .leaflet-marker-icon{pointer-events:none}.leaflet-kp-pane .kplabel{pointer-events:auto}.map-recenter{width:48px;height:48px;background:#fff;color:#2385ff;border:1px solid #a7bac4;border-radius:50%;box-shadow:0 2px 9px #00101855;display:flex;align-items:center;justify-content:center;padding:10px;margin:0 8px 14px 0}.map-recenter svg{width:26px;height:26px}.map-recenter:focus-visible{outline:3px solid #2385ff}</style>');
html = html.replace("{maxZoom:19,attribution:", "{maxZoom:19,updateWhenIdle:false,updateInterval:100,keepBuffer:4,attribution:");
const labelStart = html.indexOf('function labels(){');
const labelEnd = html.indexOf('function drawSelected(', labelStart);
if (labelStart < 0 || labelEnd < 0) throw new Error('KP labels block missing');
const labelCode = html.slice(labelStart, labelEnd)
  .replace('function labels(){kp.clearLayers();', 'const kpMarkers=new Map();function labels(){const wanted=new Set();')
  .replace('b=map.getBounds()', 'b=map.getBounds().pad(.5)')
  .replace('n++;let t=', "n++;const id=key+':'+x[0];wanted.add(id);if(kpMarkers.has(id))continue;let t=")
  .replace('L.marker([x[1],x[2]],', 'const marker=L.marker([x[1],x[2]],')
  .replace('{icon:ic,interactive:false,zIndexOffset:', "{icon:ic,pane:'kpPane',interactive:true,keyboard:false,zIndexOffset:")
  .replace('.addTo(kp)}}kc.textContent=', '.addTo(kp);kpMarkers.set(id,marker)}}for(const [id,marker] of kpMarkers){if(!wanted.has(id)){kp.removeLayer(marker);kpMarkers.delete(id)}}kc.textContent=');
html = html.slice(0,labelStart) + labelCode + html.slice(labelEnd);
html = html.replace("map.on('zoomend moveend',labels)", "let labelFrame=0;function scheduleLabels(){if(labelFrame)return;labelFrame=requestAnimationFrame(()=>{labelFrame=0;labels()})}map.on('zoomend moveend',scheduleLabels);map.on('move',scheduleLabels)");
const lightTheme = "\nbody{background:#f6f8fb;color:#172b3b}\nbutton,select,input{background:#fff;color:#20394c;border-color:#c8d4df}\nbutton:hover{background:#edf3f8}button:disabled{color:#7b8d9b}\ninput::placeholder{color:#758797}\n.tag,.chip{background:#fff;border-color:#d0dbe5;color:#294457}\n.msg{color:#536b7d}\n.facility .fname{background:#fff;color:#20374a;box-shadow:0 1px 4px #24435a22}\n.facility{filter:drop-shadow(0 1px 2px #24435a22)}\n.location-panel{background:#fff;border-color:#d5dfe8;box-shadow:0 4px 18px #28495e0c}\n.location-title,.location-road-name,.location-value strong{color:#17354b}\n.location-road-label,.location-stat-label,.location-note{color:#5a7284}\n.location-status{background:#edf2f7;color:#546e83}\n.location-status.ready{background:#e5f5ef;color:#15704e}\n.location-value{background:#f4f7fa;border-color:#dce5ed}\n.location-value.kp strong{color:#176faf}\n.traffic{background:#fff;border-color:#d5dfe8}\n.traffic-head{background:#edf4f9}.traffic-head strong{color:#20394c}\n.traffic-count{color:#176a51}.traffic-meta,.traffic-radius{color:#587185}\n.traffic-card{background:#fff;border-color:#dce5ec}\n.traffic-card:hover{background:#f0f6fc;border-color:#9cb7cc}\n.traffic-tags{color:#405e74}.traffic-tag{background:#eef3f8}\n.traffic-empty{color:#587185}.traffic-error{color:#be303d}\n.traffic-key{border-color:#dce5ed;color:#526c80}\n.leaflet-control-zoom a{background:#fff;color:#253e51}\n.map-recenter{color:#e53e4b;border-color:#efc3c8;box-shadow:0 2px 10px #97364220}\n.map-recenter:hover{background:#fff0f2}.map-recenter:focus-visible{outline-color:#e53e4b}\n.kpmark .kplabel.picked{background:#e53e4b;color:#fff;border:2px solid #fff;box-shadow:0 0 0 3px #ac2030,0 5px 14px #99223455;transform:translateX(-50%) scale(1.18);z-index:10}\n.kplabel.picked::after{content:\"選択中\";font-size:11px;font-weight:900;background:#fff;color:#b62535;border-radius:4px;padding:2px 4px;margin-left:3px}\n.kpmark:has(.kplabel.picked) .kpstem{background:#e53e4b;width:4px;box-shadow:0 0 0 1px #fff}\n";
html = html.replace('</style>', lightTheme + '</style>');
html = html.replace('</style>', "\n#gmap:not(:disabled){position:relative;overflow:hidden;background:#e53e4b;color:#fff;border-color:#bd2636;font-weight:800;box-shadow:0 3px 10px #bf293b33;animation:gmap-glow 2.8s ease-in-out infinite}\n#gmap:not(:disabled):hover{background:#cd293b}\n#gmap:not(:disabled)::after{content:\"\";position:absolute;inset:-30% auto -30% -50%;width:35%;background:linear-gradient(90deg,transparent,#ffffff55,transparent);transform:skewX(-20deg);animation:gmap-shine 4.8s ease-in-out infinite;pointer-events:none}\n@keyframes gmap-glow{0%,100%{box-shadow:0 3px 10px #bf293b33}50%{box-shadow:0 0 0 3px #e53e4b18,0 4px 14px #bf293b44}}\n@keyframes gmap-shine{0%,65%{left:-50%}90%,100%{left:130%}}\n.location-wave{position:absolute;left:50%;top:50%;width:32px;height:32px;margin:-16px;border-radius:50%;border:2px solid #ff304f;background:#ff304f0b;box-sizing:border-box;animation:location-ripple 3s ease-out infinite;pointer-events:none}\n.location-wave.second{animation-delay:-1.5s}\n@keyframes location-ripple{0%{transform:scale(.6);opacity:.6}100%{transform:scale(2.8);opacity:0}}\n@media(prefers-reduced-motion:reduce){#gmap:not(:disabled),#gmap:not(:disabled)::after,.location-wave{animation:none}#gmap:not(:disabled)::after{display:none}.location-wave{opacity:.18;transform:scale(1.6)}.location-wave.second{display:none}}\n" + '</style>');
html = html.replace('</style>', '#m{margin-left:-9px;margin-right:-9px;width:calc(100% + 18px)}.location-note{display:none}</style>');
fs.writeFileSync(file, html);
console.log('Added JARTIC/iHighway traffic list below the map with 5-minute refresh');

