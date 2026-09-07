import fs from 'fs';
const p='build.mjs';
let s=fs.readFileSync(p,'utf8');

const dataAnchor="if(!DATA.chugoku||DATA.chugoku.marks.length<2)throw Error('中国道KP固定データの生成に失敗しました');";
const facilityData=`for(const [key,v] of Object.entries(DATA)){
 const cfg=CFG[key];
 const fsx=(POINT.features||[]).filter(f=>f.properties?.road_name===cfg.official&&(f.properties?.is_IC||f.properties?.is_SIC||f.properties?.is_JCT||f.properties?.is_SAPA)).map(f=>{
  const pr=f.properties||{},co=f.geometry?.coordinates||[];let type=pr.is_JCT?'JCT':pr.is_SIC?'SIC':pr.is_SAPA?(String(pr.name||'').includes('SA')?'SA':String(pr.name||'').includes('PA')?'PA':'PA'):'IC';
  let name=String(pr.name||'');if(type==='IC'&&!/IC$/.test(name))name+='IC';if(type==='SIC'&&!/(SIC|スマートIC)$/.test(name))name+='SIC';if(type==='JCT'&&!/JCT$/.test(name))name+='JCT';return{name,type,lat:+co[1],lng:+co[0]};
 }).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&inside([x.lat,x.lng]));v.facilities=fsx;
}
if(DATA.hiroshima_iwakuni)DATA.hiroshima_iwakuni.facilities=[{name:'廿日市IC',type:'IC',lat:34.34519,lng:132.31322},{name:'廿日市JCT',type:'JCT',lat:34.336845,lng:132.294527}];
`;
if(!s.includes(dataAnchor))throw new Error('facility data anchor not found');s=s.replace(dataAnchor,facilityData+dataAnchor);

const styleAnchor='.mapactions{display:flex;gap:6px;margin:6px 0}';
const facilityStyle=`.facility{position:relative;z-index:30;white-space:nowrap;transform:translate(-7px,-7px);font-weight:900;font-size:10px;line-height:14px;filter:drop-shadow(0 2px 3px #000a)}.facility .dot{display:inline-flex;width:14px;height:14px;border-radius:50%;align-items:center;justify-content:center;border:2px solid #fff;color:#fff;font-size:7px;vertical-align:middle;box-sizing:border-box;background:var(--fc)}.facility .fname{display:inline-block;margin-left:3px;padding:2px 5px;border-radius:5px;background:#07171df5;border:1px solid var(--fc);color:#fff;vertical-align:middle}.facility.ic{--fc:#00b7ff}.facility.jct{--fc:#d96cff}.facility.sa{--fc:#35d07f}.facility.pa{--fc:#ffb23f}.facility.sic{--fc:#00d5d5}@media(max-width:600px){.facility{font-size:9px}.facility .fname{padding:1px 4px}}`;
if(!s.includes(styleAnchor))throw new Error('facility style anchor not found');s=s.replace(styleAnchor,facilityStyle+styleAnchor);

const layerAnchor="roads=L.layerGroup().addTo(map),sel=L.layerGroup().addTo(map),kp=L.layerGroup().addTo(map),";
if(!s.includes(layerAnchor))throw new Error('facility layer anchor not found');s=s.replace(layerAnchor,"roads=L.layerGroup().addTo(map),sel=L.layerGroup().addTo(map),kp=L.layerGroup().addTo(map),fac=L.layerGroup().addTo(map),");

const drawAnchor='function drawAll(){roads.clearLayers();';
const drawFacilities=`function drawFacilities(){fac.clearLayers();for(const v of Object.values(D))for(const f of(v.facilities||[])){let cls=f.type.toLowerCase(),abbr=f.type==='JCT'?'J':f.type==='PA'?'P':f.type==='IC'?'I':'S',html='<div class="facility '+cls+'"><span class="dot">'+abbr+'</span><span class="fname">'+f.name+'</span></div>',ic=L.divIcon({className:'',html,iconSize:[0,0],iconAnchor:[0,0]});L.marker([f.lat,f.lng],{icon:ic,interactive:false,zIndexOffset:5000}).addTo(fac)}}function drawAll(){drawFacilities();roads.clearLayers();`;
if(!s.includes(drawAnchor))throw new Error('facility draw anchor not found');s=s.replace(drawAnchor,drawFacilities);

fs.writeFileSync(p,s);
console.log('Added fixed IC/JCT/SA/PA/SIC markers for the four visible ROAD OPS routes');
console.log('Facility labels are prioritized above KP labels');
