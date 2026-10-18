const assert=require('node:assert/strict');
const createHarness=require('./app-harness.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const app=await createHarness('dist'),w=app.window,doc=w.document;
  app.gps([34.4557,132.7252]);
  const initial=app.watchStarts,clears=app.watchClears;
  for(const code of [2,3]){
    app.gpsError({code});assert(app.watchActive,'Temporary failure must not cancel GPS');
    assert.equal(app.watchClears,clears);
    app.now+=1000;app.gps([34.4557,132.7252]);
    assert(!doc.querySelector('#locationRoad').textContent.includes('許可'));
  }
  assert.equal(app.watchStarts,initial,'Recovery uses the existing watch');
  app.hidden=true;app.now+=31000;doc.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(app.watchStarts,initial);
  app.hidden=false;doc.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(app.watchStarts,initial+1,'Visible stale page restarts a silent watch');
  app.gps([34.4557,132.7252]);
  app.gpsError({code:1});assert(!app.watchActive);
  const denied=app.watchStarts;app.now+=31000;doc.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(app.watchStarts,denied,'Denied permission must not trigger automatic prompt loops');
  doc.querySelector('.map-recenter').click();assert(app.watchActive);
  app.gps([34.4557,132.7252]);

  await app.minute();
  const marker=doc.querySelector('.traffic-event-marker'),date=doc.querySelector('#trafficUpdated').dateTime;
  app.expectedNetworkError=true;app.captureTimeout=true;app.stallNetwork=true;
  doc.querySelector('#trafficRefresh').click();await wait(20);
  assert(doc.querySelector('#trafficRefresh').disabled);assert(app.abortTimeout);
  app.abortTimeout();await wait(30);
  assert(app.abortSignal.aborted,'The request deadline aborts the actual fetch signal');
  assert(!doc.querySelector('#trafficRefresh').disabled,'Aborted requests must release the refresh button');
  assert.equal(doc.querySelector('.traffic-event-marker'),marker,'Timeout preserves existing traffic');
  assert.equal(doc.querySelector('#trafficUpdated').dateTime,date);
  assert(doc.querySelector('#trafficUpdated').classList.contains('is-stale'));
  app.stallNetwork=false;
  const goodFeed=app.feed;app.feed={};doc.querySelector('#trafficRefresh').click();await wait(30);
  assert.equal(doc.querySelector('.traffic-event-marker'),marker,'Malformed successful response must not clear the map');
  app.feed=goodFeed;doc.querySelector('#trafficRefresh').click();await wait(30);
  app.expectedNetworkError=false;
  assert(!doc.querySelector('#trafficUpdated').classList.contains('is-stale'));
  assert.deepEqual(app.errors,[]);app.close();
  console.log('PASS: transient GPS recovery, stale resume, denied-permission behavior, real abort signal, malformed response preservation and successful retry');
}
main().catch(e=>{console.error(e);process.exit(1);});
