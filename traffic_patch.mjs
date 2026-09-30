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
const panel = '<section class="traffic" aria-label="中国地方の交通情報"><div class="traffic-head"><strong>🚧 交通情報 <span class="traffic-count" id="trafficCount">読込中</span></strong><span class="traffic-meta" id="trafficMeta">地図には全件表示 ・ 一覧は現在地周辺のみ</span><label class="traffic-radius">範囲 <select id="trafficRadius"><option value="20">20km</option><option value="50" selected>50km</option><option value="100">100km</option></select></label><button id="trafficRefresh" type="button">更新</button></div><div class="traffic-key" aria-label="交通情報の凡例"><span><i class="traffic-key-line"></i>工事・車線規制区間</span><span><i class="traffic-key-sign">↗</i>規制</span><span><i class="traffic-key-sign warning">!</i>事故・故障車・落下物</span></div><div class="traffic-list" id="trafficList"><div class="traffic-empty">現在地を取得すると周辺の詳細が表示されます。</div></div></section>';
if (!html.includes(mapAnchor)) throw new Error('traffic panel insertion point not found');
const locationPanel = '<section class="location-panel" id="locationPanel" aria-label="現在地の道路情報"><div class="location-head"><div class="location-title">現在地の道路情報</div><span class="location-status" id="locationStatus">未取得</span></div><div><span class="location-road-label">道路名</span><strong class="location-road-name" id="locationRoad">位置情報を確認しています</strong></div><div class="location-values"><div class="location-value"><span class="location-stat-label">上り・下り</span><strong id="locationDirection">—</strong></div><div class="location-value kp"><span class="location-stat-label">最寄りKP</span><strong id="locationKp">—</strong></div></div><p class="location-note" id="locationNote">移動中は進行方向から判定し、停車中は直前の移動軌跡を使います。</p></section>';
if (!html.includes('id="locationPanel"')) html = html.replace(mapAnchor, mapAnchor + locationPanel + panel);
const scriptAnchor = '</body>';
if (!html.includes(scriptAnchor)) throw new Error('traffic script insertion point not found');
html = html.replace(scriptAnchor, '<script src="/traffic-client.js"></script><script src="/location-client.js"></script><script src="/location-ui.js"></script>' + scriptAnchor);
fs.copyFileSync('traffic-client.js', 'dist/traffic-client.js');
fs.copyFileSync('location-client.js', 'dist/location-client.js');
fs.copyFileSync('location-ui.js', 'dist/location-ui.js');
fs.writeFileSync(file, html);
console.log('Added JARTIC/iHighway traffic list below the map with 5-minute refresh');
