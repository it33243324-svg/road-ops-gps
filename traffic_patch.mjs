import fs from 'node:fs';

const file = 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');
const styleAnchor = '.mapactions{display:flex;gap:6px;margin:6px 0}';
const styles = [
  '#m{height:62vh;min-height:360px}',
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
  '.traffic-pin{width:38px;height:38px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50%;color:#fff;font-size:17px;font-weight:900;line-height:1;text-shadow:0 1px 2px #001018;filter:drop-shadow(0 2px 5px #001018cc)}',
  '.traffic-pin.multi{width:42px;height:42px;border-radius:14px;font-size:15px}',
  '@media(max-width:600px){#m{height:58vh;min-height:320px}.traffic-list{max-height:34vh}.traffic-head{gap:6px}.traffic-meta{flex-basis:100%}}'
].join('');
if (!html.includes(styleAnchor)) throw new Error('traffic style anchor not found');
html = html.replace(styleAnchor, styles + styleAnchor);

const mapAnchor = '<div id=m></div>';
const panel = '<section class="traffic" aria-label="中国地方の交通情報"><div class="traffic-head"><strong>🚧 交通情報 <span class="traffic-count" id="trafficCount">読込中</span></strong><span class="traffic-meta" id="trafficMeta">地図には全件表示 ・ 一覧は現在地周辺のみ</span><label class="traffic-radius">範囲 <select id="trafficRadius"><option value="20">20km</option><option value="50" selected>50km</option><option value="100">100km</option></select></label><button id="trafficRefresh" type="button">更新</button></div><div class="traffic-list" id="trafficList"><div class="traffic-empty">現在地を取得すると周辺の詳細が表示されます。</div></div></section>';
if (!html.includes(mapAnchor)) throw new Error('traffic panel insertion point not found');
html = html.replace(mapAnchor, mapAnchor + panel);
const scriptAnchor = '</body>';
if (!html.includes(scriptAnchor)) throw new Error('traffic script insertion point not found');
html = html.replace(scriptAnchor, '<script src="/traffic-client.js"></script>' + scriptAnchor);
fs.copyFileSync('traffic-client.js', 'dist/traffic-client.js');
fs.writeFileSync(file, html);
console.log('Added JARTIC/iHighway traffic list below the map with 5-minute refresh');
