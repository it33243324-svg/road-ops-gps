(function(root){
  const km=(a,b)=>{const rad=n=>n*Math.PI/180;const h=Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)));};
  function projectKp(marks,point){
    let best=null;const cos=Math.cos(point[0]*Math.PI/180);
    for(let i=1;i<marks.length;i++){
      const a=marks[i-1],b=marks[i];if(Math.abs(b[0]-a[0])>1)continue;
      const ax=(a[2]-point[1])*cos,ay=a[1]-point[0],dx=(b[2]-a[2])*cos,dy=b[1]-a[1],den=dx*dx+dy*dy;
      const t=den?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
      const d=km(point,[a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);
      if(!best||d<best.distance)best={kp:a[0]+(b[0]-a[0])*t,distance:d};
    }return best;
  }
  function next(route,currentKp,direction){
    if(!['上り','下り'].includes(direction))return [];
    const marks=(route.marks||[]).slice().sort((a,b)=>a[0]-b[0]),sign=direction==='下り'?1:-1;
    const seen=new Set();
    const candidates=(route.facilities||[]).map(f=>({facility:f,projection:projectKp(marks,[f.lat,f.lng])})).filter(x=>x.projection&&x.projection.distance<=2)
      .map(x=>({...x,distance:(x.projection.kp-currentKp)*sign})).filter(x=>x.distance>.15).sort((a,b)=>a.distance-b.distance);
    const results=[];
    for(const group of [['IC','SIC'],['PA','SA']]){
      const match=candidates.find(x=>group.includes(x.facility.type)&&!seen.has(x.facility.name));
      if(match){seen.add(match.facility.name);results.push(match);}
    }return results;
  }
  root.KPMAPNextFacilities={projectKp,next};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.KPMAPNextFacilities;
  if(typeof document==='undefined')return;
  const panel=document.createElement('aside');panel.className='next-facilities';panel.setAttribute('aria-label','進行方向の次のIC・PA');panel.innerHTML='<strong>次のIC・PA</strong><span>現在地・進行方向を確認すると表示</span>';
  document.querySelector('.top').appendChild(panel);
  window.addEventListener('kpmap-road-location',event=>{
    const d=event.detail;
    panel.replaceChildren();const title=document.createElement('strong');title.textContent='次のIC・PA';panel.appendChild(title);
    const text=document.createElement('span');panel.appendChild(text);
    if(d.roadDistance>.5){text.textContent='高速道路上で表示します';return;}
    if(!['上り','下り'].includes(d.direction)){text.textContent=d.direction==='判定中'?'進行方向を判定中…':'進行方向の取得待ち';return;}
    const list=next(D[d.routeKey],d.kp,d.direction);
    text.textContent=D[d.routeKey].name+' '+d.direction;
    for(const x of list){const item=document.createElement('span');item.className='next-facility-item';item.textContent=x.facility.name+'  約'+x.distance.toFixed(1)+'km';item.title='現在地KPと施設付近の推定KPとの差。参考距離です。';panel.appendChild(item);}
    if(!list.length)text.textContent+=' ・ 前方の施設データなし';
  });
  window.addEventListener('kpmap-location-error',()=>{panel.innerHTML='<strong>次のIC・PA</strong><span>現在地・進行方向の取得待ち</span>';});
})(typeof window!=='undefined'?window:globalThis);
