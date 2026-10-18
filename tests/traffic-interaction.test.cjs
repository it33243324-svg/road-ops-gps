const assert=require('node:assert/strict');
const createHarness=require('./app-harness.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const app=await createHarness('dist'),doc=app.window.document;
  const marker=Object.values(app.map._layers).find(m=>m.options?.icon?.options?.className==='traffic-event-marker');
  const point=marker.getLatLng();app.gps([point.lat,point.lng],90,0);
  app.map.setZoom(12);await wait(80);
  const card=doc.querySelector('.traffic-card[data-event]');assert(card);
  card.click();await wait(300);
  assert.equal(app.map.getZoom(),14,'A nearby list entry must navigate to its real map point');
  assert(app.map._popup?.isOpen(),'Zoom regrouping must keep the requested traffic details open');
  app.map.setZoom(15);await wait(150);
  assert(app.map._popup?.isOpen(),'An already-open popup must survive marker regrouping');
  app.feed=JSON.parse(JSON.stringify(app.feed));
  app.feed.events[0].mapX=Number(app.feed.events[0].mapX||0)+1;
  await app.minute();
  const unchangedCard=doc.querySelector('.traffic-card[data-event]');
  assert.equal(unchangedCard,card,'Unchanged list HTML keeps the same card node');
  unchangedCard.click();await wait(100);
  assert(app.map._popup?.isOpen(),'A reused card must target the refreshed event/marker objects');
  assert.deepEqual(app.errors,[]);app.close();
  console.log('PASS: traffic-card navigation, popup preservation across zoom regrouping and current event references on reused cards');
}
main().catch(e=>{console.error(e);process.exit(1);});
