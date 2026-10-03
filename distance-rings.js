(() => {
  map.createPane('distanceRingPane');
  const pane=map.getPane('distanceRingPane');pane.style.zIndex='350';pane.style.pointerEvents='none';
  map.getPane('overlayPane').parentElement.appendChild(pane);
  const renderer=L.canvas({pane:'distanceRingPane',padding:.5});
  const circles=[],tags=[];
  window.addEventListener('kpmap-location',event=>{
    const point=[event.detail.lat,event.detail.lng];
    if(!circles.length)for(const radius of [5000,10000]){
      circles.push(L.circle(point,{pane:'distanceRingPane',renderer,radius,color:'#52778e',weight:1,opacity:radius===5000?.55:.35,fill:false,interactive:false}).addTo(map));
      tags.push(L.marker(point,{interactive:false,keyboard:false,zIndexOffset:-1000,icon:L.divIcon({className:'distance-ring-tag',iconSize:[40,16],iconAnchor:[20,8],html:radius/1000+' km'})}).addTo(map));
    }
    circles.forEach(c=>c.setLatLng(point));
    // Spherical destination due north; labels stay upright during map rotation.
    tags.forEach((tag,i)=>tag.setLatLng([point[0]+(i===0?5:10)/6371*180/Math.PI,point[1]]));
  });
})();
