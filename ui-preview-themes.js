(()=>{const n=Number(new URLSearchParams(location.search).get('ui-preview') || 19);const themes=[["アイスブルー","#f2f7fc","#e8f2fc","#eef6fe","#bfd7ef",12,0],["ウォームホワイト","#faf8f5","#fff1e5","#fff8f1","#ead8c4",14,0],["ミント","#f2f8f6","#e5f4ec","#eff9f4","#bcdccc",14,0],["ラベンダー","#f6f4fb","#eeebfa","#f6f2ff","#d2c9ea",14,0],["スレート","#f1f4f7","#e7edf3","#f4f7fa","#c6d1dc",8,0],["ピーチ","#fff7f4","#ffece4","#fff4ee","#efccbc",16,0],["スカイ＆ミント","#f2f8fb","#e7f2fc","#eaf7f1","#c0d7e4",14,0],["サンド","#f8f6f0","#f1eddf","#faf7ee","#ded5bd",10,0],["ホワイトカード","#f1f4f8","#ffffff","#f8faff","#d8e1eb",16,1],["ソフトローズ","#faf4f6","#f9eaf0","#fff4f7","#e8ccd7",14,0],["クールシアン","#f1f8fa","#e5f3f6","#effafd","#b8dbe3",10,0],["グレージュ","#f5f4f2","#ebe8e4","#faf8f5","#d5cfc7",8,0],["ブルーライン","#f8fbfe","#eef5fe","#f7fbff","#a7c8ed",6,0],["オレンジライン","#fffaf6","#fff0e1","#fff8ef","#ebc69f",6,0],["グリーンライン","#f6fbf8","#eaf5ed","#f4fbf6","#b2d6bc",6,0],["パール","#f8f9fb","#f6f4fa","#fafbfe","#dedee9",20,1],["サンセットライト","#fff8f5","#ffefe7","#fff3f5","#efc9b8",18,1],["ネイビーフレーム","#eef3f8","#e5edf7","#f6f9ff","#aebed3",10,1],["フラットミニマル","#ffffff","#f5f7f9","#fafbfc","#e1e6eb",3,0],["プレミアムクリーム","#f7f5f0","#fff7e8","#fffdf7","#ddd0b3",18,1]];if(!Number.isInteger(n)||n<1||n>themes.length)return;const [name,bg,head,panel,border,radius,shadow]=themes[n-1];const style=document.createElement('style');style.textContent=`
body{background:${bg}}
.kpmap-brand-header{background:${head};border-color:${border};border-radius:${radius}px;box-shadow:${shadow?'0 6px 22px #24435a0c':'none'};margin-bottom:12px}
.kpmap-toolbar{border:1px solid ${border};background:${panel};border-radius:${radius}px;padding:12px;margin-bottom:12px}
.kpmap-toolbar button,.kpmap-toolbar input,.kpmap-toolbar select{border-color:${border};border-radius:${Math.min(radius,10)}px}
.kpmap-toolbar .next-facilities{background:#ffffffb8;border-color:${border};border-radius:${Math.min(radius,12)}px}
.legend{padding:7px 0 10px}
.traffic{margin-top:16px;background:white;border-color:${border};border-radius:${radius}px;box-shadow:${shadow?'0 6px 22px #24435a0c':'none'}}
.traffic-head{background:${panel};padding:13px 15px;gap:9px;border-bottom:1px solid ${border}}
.traffic-key{background:#ffffff;padding:9px 15px;border-color:${border}}
.traffic-list{padding:12px}
.traffic-group+.traffic-group{border-color:${border}}
.traffic-group-cards .traffic-card{border-radius:${Math.min(radius,12)}px;border-top-color:${border};border-right-color:${border};border-bottom-color:${border};padding:12px;background:#fff}
.traffic-tags{gap:6px}.traffic-tag{background:${panel};padding:3px 7px}
@media(max-width:900px){.kpmap-toolbar{display:block;padding:10px}.kpmap-toolbar .top{margin-bottom:8px}.kpmap-toolbar .mapactions{margin-bottom:0}}
`;document.head.append(style)})();