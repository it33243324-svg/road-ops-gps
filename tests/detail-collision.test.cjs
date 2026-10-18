const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('map-details.js','utf8');
const start=source.indexOf('  const intersects='),end=source.indexOf('  function draw()',start);
const context={};vm.createContext(context);vm.runInContext(source.slice(start,end)+';this.make=collisionIndex;this.hit=intersects;',context);
let seed=193;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const rect=()=>{const left=random()*4000-2000,top=random()*4000-2000,width=10+random()*180,height=10+random()*40;return{left,top,right:left+width,bottom:top+height,width,height}};
const rows=Array.from({length:1500},rect);
rows.push({...rows[0]},rows[0],{left:-1000,right:1000,top:0,bottom:60});
const index=context.make(rows);let comparisons=0;
for(let i=0;i<2000;i++){
 if(i%4===0){const r=rect();rows.push(r);index.add(r);}
 const q=i%20===0?{left:96,right:192,top:-96,bottom:0}:rect();
 const expected=rows.filter(r=>context.hit(q,r)).length;
 assert.equal(index.count(q),expected);comparisons++;
}
const sparse=context.make([]);for(let i=0;i<31;i++){const r=rect();sparse.add(r);}
const edges=[{left:0,right:10,top:0,bottom:10},{left:15,right:20,top:0,bottom:10},{left:14.999,right:20,top:0,bottom:10}];
const edgeIndex=context.make(edges);for(const q of edges)assert.equal(edgeIndex.count(q),edges.filter(r=>context.hit(q,r)).length);
console.log('PASS: '+comparisons+' dense collision comparisons, dynamic insertions, negative cells, duplicate rectangles and exact five-pixel edges');
