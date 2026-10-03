(() => {
  const keys=['sanyo','chugoku','hiroshima','hiroshima_iwakuni'];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const layer=L.layerGroup().addTo(map);
  map.createPane('detailLabelPane');
  const pane=map.getPane('detailLabelPane');pane.style.zIndex='590';pane.style.pointerEvents='none';
  map.getPane('markerPane').parentElement.appendChild(pane);
  const items=keys.flatMap(key=>{
    const seen=new Set();
    return (window.KPMAP_TRAFFIC_LANDMARKS?.routes?.[key]||[]).filter(x=>['tunnel','bridge'].includes(x.type)).filter(x=>{
      const name=x.name.split(';').at(-1);if(seen.has(name))return false;seen.add(name);return true;
    }).map(x=>({...x,name:x.name.split(';').at(-1)}));
  });
  function draw(){
    layer.clearLayers();if(map.getZoom()<14)return;
    const bounds=map.getBounds().pad(.3);
    for(const x of items){if(!bounds.contains(x.point))continue;
      const text=x.type==='tunnel'?x.name.replace(/トンネル$/,'TN'):x.name;
      L.marker(x.point,{pane:'detailLabelPane',interactive:false,keyboard:false,icon:L.divIcon({className:'detail-label-marker',iconSize:[0,0],iconAnchor:[0,0],html:'<span class="detail-label">'+escape(text)+'</span>'})}).addTo(layer);
    }
  }
  let frame=0;function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;draw()});}
  map.on('moveend zoomend',schedule);draw();
})();
