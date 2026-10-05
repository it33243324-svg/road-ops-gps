(() => {
  const keys=['sanyo','chugoku','hiroshima','hiroshima_iwakuni'];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const layer=L.layerGroup().addTo(map);
  map.createPane('detailLabelPane');
  const pane=map.getPane('detailLabelPane');pane.style.zIndex='590';pane.style.pointerEvents='none';
  map.getPane('markerPane').parentElement.appendChild(pane);
  const items=keys.flatMap(key=>{
    const seen=new Map();
    return (window.KPMAP_TRAFFIC_LANDMARKS?.routes?.[key]||[]).filter(x=>['tunnel','bridge'].includes(x.type)).filter(x=>{
      const name=x.name.split(';').at(-1),points=seen.get(name)||[];if(points.some(p=>map.distance(p,x.point)<600))return false;points.push(x.point);seen.set(name,points);return true;
    }).map(x=>({...x,key,name:x.name.split(';').at(-1)}));
  });
  // Use local road tangent, rather than the overall bend of a long tunnel.
  const tangentPairs = new WeakMap();
  function tangent(x){
    let pair = tangentPairs.get(x);
    if (pair === undefined) {
    const paths=x.variants?.map(v=>v.path).filter(p=>p?.length>1)||[];
    if(x.path?.length>1)paths.push(x.path);if(!paths.length)paths.push(...(D[x.key]?.segs||[]));
    let best=Infinity;pair=null;
    for(const path of paths)for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],cx=Math.cos(x.point[0]*Math.PI/180);
      const dx=(b[1]-a[1])*cx,dy=b[0]-a[0],px=(x.point[1]-a[1])*cx,py=x.point[0]-a[0];
      const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));
      const distance=(px-t*dx)**2+(py-t*dy)**2;
      if(distance<best&&dx*dx+dy*dy>1e-14){best=distance;pair=[a,b];}
    }
    tangentPairs.set(x,pair);
    }
    if(!pair)return 0;
    const a=map.latLngToContainerPoint(pair[0]),b=map.latLngToContainerPoint(pair[1]);
    let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    while(angle>90)angle-=180;while(angle<-90)angle+=180;return angle;
  }
  const intersects=(a,b)=>a.left<b.right+5&&a.right>b.left-5&&a.top<b.bottom+5&&a.bottom>b.top-5;
  function draw(){
    layer.clearLayers();if(map.getZoom()<14)return;
    const bounds=map.getBounds().pad(.3),root=map.getContainer().getBoundingClientRect();
    const occupied=Array.from(map.getContainer().querySelectorAll('.kplabel,.fname,.traffic-event-marker,.leaflet-control,.location-panel')).map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);
    for(const x of items){if(!bounds.contains(x.point))continue;
      const text=x.type==='tunnel'?x.name.replace(/トンネル$/,'TN'):x.name;
      const angle=tangent(x),vertical=Math.abs(angle)>=60,rotation=vertical?angle-(angle>0?90:-90):angle;
      const marker=L.marker(x.point,{pane:'detailLabelPane',interactive:false,keyboard:false,icon:L.divIcon({className:'detail-label-marker',iconSize:[0,0],iconAnchor:[0,0],html:'<span class="detail-label'+(vertical?' detail-vertical':'')+'" style="--detail-angle:'+rotation+'deg" title="'+escape(x.name)+'">'+escape(text)+'</span>'})}).addTo(layer);
      const span=marker.getElement()?.querySelector('.detail-label');if(!span)continue;
      const p=map.latLngToContainerPoint(x.point),rad=angle*Math.PI/180,tx=Math.cos(rad),ty=Math.sin(rad),nx=-ty,ny=tx;
      const offsets=[[0,5],[0,-5],[6,8],[-6,8],[6,-8],[-6,-8],[12,10],[-12,10],[12,-10],[-12,-10],[0,18],[0,-18],[18,14],[-18,14],[18,-14],[-18,-14],[0,20],[0,-20]];
      const initial=span.getBoundingClientRect();
      let chosen=null,chosenRect=null,score=Infinity;
      for(const [along,side] of offsets){
        const dx=tx*along+nx*side,dy=ty*along+ny*side;
        const q=L.point(p.x+dx,p.y+dy);
        const r={left:initial.left+dx,right:initial.right+dx,top:initial.top+dy,bottom:initial.bottom+dy,width:initial.width,height:initial.height};
        const hits=occupied.filter(o=>intersects(r,o)).length;
        const clipped=r.width&&(r.left<root.left||r.right>root.right||r.top<root.top||r.bottom>root.bottom)?2:0;
        const gap=Math.abs(along)+Math.abs(side)*.7,cost=hits*.4+clipped*100+gap*.1;if(cost<score){score=cost;chosen=q;chosenRect=r;}if(score===0)break;
      }
      if(chosen)marker.setLatLng(map.containerPointToLatLng(chosen));
      const rect=chosenRect||initial;if(rect.width&&rect.height)occupied.push(rect);
    }
  }
  let frame=0;function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;draw()});}
  map.on('moveend zoomend rotate',schedule);
  const observer=new MutationObserver(schedule);
  // Traffic updates and KP selection can change overlap without moving the map.
  for(const name of ['kpPane','selectedKpPane','trafficPriority0','trafficPriority1','trafficPriority2','trafficPriority3','trafficPriority4','trafficPriority5']){
    const p=map.getPane(name);if(p)observer.observe(p,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  map.on('trafficrendered',schedule);draw();
})();
