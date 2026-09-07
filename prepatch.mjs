import fs from 'fs';
const p='build.mjs';
let s=fs.readFileSync(p,'utf8');
const old=`// 広島岩国道路はE2山陽道と同一路面を通るため、山陽道の高精度固定線形から廿日市〜大竹区間を抽出する。\nif(DATA.sanyo?.segs?.length&&DATA.hiroshima_iwakuni){const hi=[];for(const seg of DATA.sanyo.segs){const pts=seg.filter(p=>p[0]>=34.235&&p[0]<=34.365&&p[1]>=132.205&&p[1]<=132.345);if(pts.length>1)hi.push(pts)}if(hi.length){DATA.hiroshima_iwakuni.segs=hi;DATA.hiroshima_iwakuni.quality='official-derived'}}`;
const neu=`// ROAD OPS独自定義: 広島岩国道路は廿日市IC〜廿日市JCTだけを扱う。\nif(DATA.hiroshima_iwakuni){\n const branch=[[34.34519,132.31322],[34.34555,132.31055],[34.34525,132.30775],[34.34435,132.30475],[34.34295,132.30185],[34.34105,132.29910],[34.33905,132.29685],[34.336845,132.294527]];\n const c=cum(branch), total=c.at(-1);\n DATA.hiroshima_iwakuni.segs=[branch];\n DATA.hiroshima_iwakuni.marks=[];\n for(let k=0;k<=2.5+1e-8;k+=.1){const p=at(branch,c,(k/2.5)*total);DATA.hiroshima_iwakuni.marks.push([+k.toFixed(1),+p[0].toFixed(6),+p[1].toFixed(6)])}\n DATA.hiroshima_iwakuni.quality='roadops-custom';\n}`;
if(!s.includes(old)) throw new Error('target patch block not found');
s=s.replace(old,neu);

// 表示対象は中国道・山陽道・広島岩国道路・広島道の4路線だけ。
const dataAnchor="if(!DATA.chugoku||DATA.chugoku.marks.length<2)throw Error('中国道KP固定データの生成に失敗しました');";
const keep=`const KEEP=new Set(['chugoku','sanyo','hiroshima_iwakuni','hiroshima']);for(const k of Object.keys(DATA))if(!KEEP.has(k))delete DATA[k];\n`;
if(!s.includes(dataAnchor)) throw new Error('DATA filter anchor not found');
s=s.replace(dataAnchor,keep+dataAnchor);

// 全4路線のKPラベルを常時対象にする。道路選択には依存させない。
const oldKeys="keys=[...new Set(['sanyo','chugoku',r.value])]";
const newKeys="keys=Object.keys(D)";
if(!s.includes(oldKeys)) throw new Error('KP label selection block not found');
s=s.replace(oldKeys,newKeys);

// 広域表示だけ5kmから10kmへ。その他の縮尺は既存仕様を維持。
const oldStep="function step(){let z=map.getZoom();return z>=15?.1:z>=13?.5:z>=11?1:5}";
const newStep="function step(){let z=map.getZoom();return z>=15?.1:z>=13?.5:z>=11?1:10}";
if(!s.includes(oldStep)) throw new Error('zoom density block not found');
s=s.replace(oldStep,newStep);

const oldCount="kc.textContent=(D.sanyo?.marks?.length||0)+(D.chugoku?.marks?.length||0);msg.textContent='山陽道・中国道KP：広域=5.0km / 1.0km / 0.5km / 0.1km ・ 表示 '+n+'件'";
const newCount="kc.textContent=Object.values(D).reduce((a,v)=>a+(v.marks?.length||0),0);msg.textContent='4路線KP：広域=10km / 1.0km / 0.5km / 0.1km ・ 表示 '+n+'件'";
if(!s.includes(oldCount)) throw new Error('KP count/message block not found');
s=s.replace(oldCount,newCount);

fs.writeFileSync(p,s);
console.log('Applied ROAD OPS Hiroshima-Iwakuni definition: Hatsukaichi IC-JCT only');
console.log('Limited map to Chugoku, Sanyo, Hiroshima-Iwakuni and Hiroshima routes');
console.log('Applied persistent KP labels for 4 routes; wide zoom density = 10km');
