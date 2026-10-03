(function(root){
  const duration=10*60000;
  const key=e=>JSON.stringify([e.road,e.category,e.title,e.direction,e.reason,e.detail]);
  function create(saved){
    let initialized=!!saved?.initialized;
    const seen=new Map(Array.isArray(saved?.seen)?saved.seen:[]);
    return {
      update(events,now=Date.now()){
        for(const e of events){const id=key(e);if(!seen.has(id))seen.set(id,initialized?now:null);}
        initialized=true;
      },
      isNew(e,now=Date.now()){const time=seen.get(key(e));return typeof time==='number'&&now>=time&&now-time<duration;},
      snapshot(){return {initialized,seen:[...seen]};}
    };
  }
  const api={create,key,duration};root.KPMAPTrafficNew=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
