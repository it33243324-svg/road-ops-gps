(() => {
  map.createPane('distanceRingPane');
  const pane=map.getPane('distanceRingPane');pane.style.zIndex='350';pane.style.pointerEvents='none';
  map.getPane('overlayPane').parentElement.appendChild(pane);
  const renderer=L.canvas({pane:'distanceRingPane',padding:.5});
  const circles=[],tags=[],compass=[];
  function destination(point,km,bearing){
    const rad=n=>n*Math.PI/180,lat=rad(point[0]),lng=rad(point[1]),angle=km/6371,b=rad(bearing);
    const y=Math.asin(Math.sin(lat)*Math.cos(angle)+Math.cos(lat)*Math.sin(angle)*Math.cos(b));
    const x=lng+Math.atan2(Math.sin(b)*Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(y));
    return [y*180/Math.PI,x*180/Math.PI];
  }
  window.addEventListener('kpmap-location',event=>{
    const point=[event.detail.lat,event.detail.lng];
    if(!circles.length)for(const radius of [5000,10000]){
      circles.push(L.circle(point,{pane:'distanceRingPane',renderer,radius,color:'#c94a58',weight:1,opacity:radius===5000?.65:.4,fill:false,interactive:false}).addTo(map));
      tags.push(L.marker(point,{interactive:false,keyboard:false,zIndexOffset:-1000,icon:L.divIcon({className:'distance-ring-tag',iconSize:[40,16],iconAnchor:[20,8],html:radius/1000+' km'})}).addTo(map));
    }
    circles.forEach(c=>c.setLatLng(point));
    tags.forEach((tag,i)=>tag.setLatLng(destination(point,i===0?5:10,90)));
    if(!compass.length)for(const [letter,bearing] of [['N',0],['E',90],['S',180],['W',270]]){
      compass.push({bearing,marker:L.marker(point,{interactive:false,keyboard:false,zIndexOffset:-1000,icon:L.divIcon({className:'distance-compass-tag',iconSize:[16,16],iconAnchor:[8,8],html:letter})}).addTo(map)});
    }
    // Geographic destinations, not screen-fixed positions: N follows true north.
    compass.forEach(x=>x.marker.setLatLng(destination(point,10.7,x.bearing)));
  });
})();
