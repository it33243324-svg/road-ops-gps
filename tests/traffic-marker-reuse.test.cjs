const assert=require('node:assert/strict'),create=require('./app-harness.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const app=await create('dist',{width:390,height:844}),doc=app.window.document;
 const before=[...doc.querySelectorAll('.traffic-event-marker')];const marker=Object.values(app.map._layers).find(m=>m.options?.icon?.options?.className==='traffic-event-marker');marker.openPopup();
 for(let i=0;i<30;i++){app.map.fire('rotate');await wait(20);}
 assert.deepEqual([...doc.querySelectorAll('.traffic-event-marker')],before,'Unchanged rotation/grouping keeps existing icon nodes');
 assert(app.map._popup?.isOpen());
 for(const angle of [45,90,180,270,0]){app.map.setBearing(angle);await wait(60);assert(app.map._popup?.isOpen(),'Details survive real bearing/grouping changes');assert.equal([...doc.querySelectorAll('.traffic-event-marker')].reduce((n,e)=>n+(Number(e.querySelector('.traffic-cluster-count')?.textContent)||1),0),32,'Rotation retains all traffic events');}
 assert.deepEqual(app.errors,[]);app.close();console.log('PASS: traffic icon reuse on unchanged grouping, real bearing changes, retained event counts and open popup');
})().catch(e=>{console.error(e);process.exit(1)});
