const assert=require('node:assert/strict'),create=require('./app-harness.cjs'),locate=require('../traffic-location.js'),present=require('../traffic-presentation.js'),routes=require('./read-route-data.cjs')();
const routeByName={'山陽道':'sanyo','中国道':'chugoku','広島道':'hiroshima','広島岩国道路':'hiroshima_iwakuni'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const app=await create('dist',{width:390,height:844}),w=app.window,doc=w.document;
 const feed=JSON.parse(JSON.stringify(app.feed.events)).filter(e=>routeByName[e.road]);locate.resolveEvents(feed,routes,require('../traffic-landmarks.json'),routeByName);
 const point=feed.find(e=>e.mapPoint).mapPoint;
 let previousIds=null,previousCards=null,patches=0;
 for(let i=0;i<80;i++){
  const p=[point[0]+i*.00001,point[1]+i*.00004];app.now+=1000;app.gps(p,90,25,8);
  const groups=present.nearbyGroups(feed,p,20),expected=[...groups.priority,...groups.regulation];
  const cards=[...doc.querySelectorAll('[data-event]')],ids=expected.map(x=>x.event.road+':'+x.event.title);
  assert.equal(cards.length,expected.length);
  for(let n=0;n<cards.length;n++)assert.equal(cards[n].querySelector('.traffic-distance').textContent,'約'+expected[n].distance.toFixed(1)+'km');
  if(JSON.stringify(ids)===JSON.stringify(previousIds)){assert.deepEqual(cards,previousCards,'Distance-only updates retain button elements');patches++;}
  previousIds=ids;previousCards=cards;
 }
 assert(patches>50);const card=previousCards[0];card.focus();app.now+=1000;app.gps([point[0]+.00079,point[1]+.00316],90,25,8);assert.equal(doc.activeElement,card,'Focus survives GPS distance updates');
 // An empty nearby list must still rebuild unresolved information on new feeds.
 w.dispatchEvent(new w.CustomEvent('kpmap-location',{detail:{lat:0,lng:0}}));
 app.feed.events.push({road:'山陽道',title:'test-unknown-a',category:'accident',reason:'test'});await app.minute();assert(doc.querySelector('#trafficList').textContent.includes('test-unknown-a'));
 app.feed.events=app.feed.events.filter(e=>e.title!=='test-unknown-a');await app.minute();assert(!doc.querySelector('#trafficList').textContent.includes('test-unknown-a'));
 // Occurrence text may become valid as a future timestamp enters its one-minute allowance.
 const target=app.feed.events.find(e=>e.road===feed.find(e=>e.mapPoint).road&&e.title===feed.find(e=>e.mapPoint).title);
 target.occurredAt=new Date(app.now+120000).toISOString();target.detail=(target.detail||'')+' age-reuse-test';await app.minute();
 const moveHere=()=>w.dispatchEvent(new w.CustomEvent('kpmap-location',{detail:{lat:point[0],lng:point[1]}}));moveHere();
 const getTarget=()=>[...doc.querySelectorAll('[data-event]')].find(e=>e.textContent.includes('age-reuse-test'));
 assert(getTarget());assert.equal(getTarget().querySelector('.traffic-age'),null);
 app.now+=60001;moveHere();assert(getTarget().querySelector('.traffic-age').textContent.includes('1分未満'));
 const agedCard=getTarget();app.now+=120000;moveHere();assert.equal(getTarget(),agedCard);assert(getTarget().querySelector('.traffic-age').textContent.includes('1分'));
 app.offline=true;app.now+=10*60000;await app.minute();assert.equal(doc.querySelector('.traffic-new'),null,'Local badge expiry works even when fetching fails');app.offline=false;
 assert.deepEqual(app.errors,[]);app.close();
 console.log('PASS: live distances and ordering, retained buttons/focus, unresolved-feed changes, occurrence-age transitions and offline badge expiry');
}
main().catch(e=>{console.error(e);process.exit(1)});
