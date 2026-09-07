import fs from 'fs';
const p='build.mjs';
let s=fs.readFileSync(p,'utf8');
const old=`// 広島岩国道路はE2山陽道と同一路面を通るため、山陽道の高精度固定線形から廿日市〜大竹区間を抽出する。\nif(DATA.sanyo?.segs?.length&&DATA.hiroshima_iwakuni){const hi=[];for(const seg of DATA.sanyo.segs){const pts=seg.filter(p=>p[0]>=34.235&&p[0]<=34.365&&p[1]>=132.205&&p[1]<=132.345);if(pts.length>1)hi.push(pts)}if(hi.length){DATA.hiroshima_iwakuni.segs=hi;DATA.hiroshima_iwakuni.quality='official-derived'}}`;
const neu=`// ROAD OPS独自定義: 広島岩国道路は廿日市IC〜廿日市JCTだけを扱う。\nif(DATA.hiroshima_iwakuni){\n const branch=[[34.34519,132.31322],[34.34555,132.31055],[34.34525,132.30775],[34.34435,132.30475],[34.34295,132.30185],[34.34105,132.29910],[34.33905,132.29685],[34.336845,132.294527]];\n const c=cum(branch), total=c.at(-1);\n DATA.hiroshima_iwakuni.segs=[branch];\n DATA.hiroshima_iwakuni.marks=[];\n for(let k=0;k<=2.5+1e-8;k+=.1){const p=at(branch,c,(k/2.5)*total);DATA.hiroshima_iwakuni.marks.push([+k.toFixed(1),+p[0].toFixed(6),+p[1].toFixed(6)])}\n DATA.hiroshima_iwakuni.quality='roadops-custom';\n}`;
if(!s.includes(old)) throw new Error('target patch block not found');
s=s.replace(old,neu);

// 全道路のKPラベルを常時対象にする。縮尺ごとの間引き(step/showK)は既存仕様を維持。
const oldKeys="keys=[...new Set(['sanyo','chugoku',r.value])]";
const newKeys="keys=Object.keys(D)";
if(!s.includes(oldKeys)) throw new Error('KP label selection block not found');
s=s.replace(oldKeys,newKeys);

const oldCount="kc.textContent=(D.sanyo?.marks?.length||0)+(D.chugoku?.marks?.length||0);msg.textContent='山陽道・中国道KP：広域=5.0km / 1.0km / 0.5km / 0.1km ・ 表示 '+n+'件'";
const newCount="kc.textContent=Object.values(D).reduce((a,v)=>a+(v.marks?.length||0),0);msg.textContent='全道路KP：広域=5.0km / 1.0km / 0.5km / 0.1km ・ 表示 '+n+'件'";
if(!s.includes(oldCount)) throw new Error('KP count/message block not found');
s=s.replace(oldCount,newCount);

fs.writeFileSync(p,s);
console.log('Applied ROAD OPS Hiroshima-Iwakuni definition: Hatsukaichi IC-JCT only');
console.log('Applied persistent KP labels for all roads with existing zoom density rules');
