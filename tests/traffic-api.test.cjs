const assert=require('node:assert/strict'),handler=require('../api/traffic.js');
async function main(){
  const original=global.fetch;let calls=0,payload,status=200;
  global.fetch=async()=>{calls++;return {ok:status===200,status,json:async()=>payload};};
  const request=async(method='GET')=>{const result={headers:{}};const response={setHeader(k,v){result.headers[k]=v;},status(code){result.status=code;return this;},json(body){result.body=body;return this;}};await handler({method},response);return result;};
  try{
    payload={area07:{trafficInfo:{jam:[{roadName:'山陽道',info:[{title:'広島IC付近',coordinate:[null,{startX:10,endX:20,startY:20,endY:30}]}]}]},otherTrafficInfo:{}}};
    const good=await request();assert.equal(good.status,200);assert.equal(good.body.events.length,1);assert.equal(good.body.events[0].mapX,15);assert.equal(good.body.events[0].mapY,25);
    assert.equal(good.headers['Cache-Control'],'no-store, max-age=0','Live traffic never inherits static cache policy');
    const before=calls,post=await request('POST');assert.equal(post.status,405);assert.equal(post.headers.Allow,'GET');assert.equal(calls,before);
    status=503;assert.equal((await request()).status,502);
    status=200;payload={area07:null};assert.equal((await request()).status,502);
    payload={area07:{trafficInfo:{},otherTrafficInfo:{}}};const empty=await request();assert.equal(empty.status,200);assert.deepEqual(empty.body.events,[]);
    console.log('PASS: malformed coordinate tolerance, live no-store policy, HTTP method guards, upstream failure and legitimate empty feed');
  }finally{global.fetch=original;}
}
main().catch(e=>{console.error(e);process.exit(1);});
