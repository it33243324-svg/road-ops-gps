// Long-running paired replay, using public road coordinates and synthetic GPS.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const createHarness=require('./app-harness.cjs'),readRoutes=require('./read-route-data.cjs');
async function main(){
  const minutes=Number(process.argv[2]||24),baseline=process.argv[3],out=process.argv[4]||'/tmp/kpmap-performance-soak.json';
  if(!baseline)throw Error('Baseline dist directory required');
  const old=await createHarness(baseline),next=await createHarness('dist');
  const marks=readRoutes('dist/index.html').sanyo.marks;
  const begin=marks.findIndex(m=>m[0]===280),ticks=Math.round(minutes*60),records=[];
  let totalOld=0,totalNew=0;
  const start=Date.now();
  for(let i=0;i<ticks;i++){
    const a=marks[begin+Math.floor(i/4)],b=marks[begin+Math.floor(i/4)+1],t=(i%4)/4;
    const p=[a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
    const heading=(Math.atan2((b[2]-a[2])*Math.cos(p[0]*Math.PI/180),b[1]-a[1])*180/Math.PI+360)%360;
    for(const app of [old,next])app.now=start+i*1000;
    let now=performance.now();old.gps(p,heading);totalOld+=performance.now()-now;
    now=performance.now();next.gps(p,heading);totalNew+=performance.now()-now;
    assert.deepEqual(next.summary(),old.summary(),'GPS result must agree with baseline at tick '+i);
    if(i&&i%60===0){
      await old.minute();await next.minute();
      const record={minute:i/60,oldGpsMs:totalOld,newGpsMs:totalNew,oldStrokes:old.strokeCalls,newStrokes:next.strokeCalls,
        heapMB:process.memoryUsage().heapUsed/1048576,domNodes:next.window.document.querySelectorAll('*').length};records.push(record);
      fs.writeFileSync(out,JSON.stringify({status:'running',ticks:i,records},null,2));console.log(JSON.stringify(record));
    }
    assert.deepEqual(old.errors,[]);assert.deepEqual(next.errors,[]);
    const remaining=start+(i+1)*1000-Date.now();if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
  }
  const result={status:'passed',ticks,elapsedSeconds:(Date.now()-start)/1000,oldGpsMs:totalOld,newGpsMs:totalNew,
    oldStrokes:old.strokeCalls,newStrokes:next.strokeCalls,records};
  fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));old.close();next.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
