import fs from 'node:fs';

// Home-screen artwork is local and opaque. iOS supplies its own corner mask.
const directory='assets/app-icons';
fs.mkdirSync('dist/icons',{recursive:true});
for(const file of fs.readdirSync(directory)) fs.copyFileSync(directory+'/'+file,'dist/icons/'+file);
fs.copyFileSync(directory+'/apple-touch-icon-pure-kp-v1.png','dist/apple-touch-icon.png');
const manifest={id:'/',name:'KPMAP',short_name:'KPMAP',lang:'ja',
  description:'中国地方の高速道路のKP・現在地・交通情報',
  start_url:'/',scope:'/',display:'browser',background_color:'#ffffff',theme_color:'#f6f8fb',
  icons:[192,512].map(size=>({src:'/icons/kpmap-pure-kp-'+size+'-v1.png',sizes:size+'x'+size,type:'image/png',purpose:'any'}))};
fs.writeFileSync('dist/site.webmanifest',JSON.stringify(manifest,null,2)+'\n');
const file='dist/index.html';let html=fs.readFileSync(file,'utf8');
if(!html.includes('</head>'))throw Error('Missing HTML head for home-screen icon metadata');
if(/rel=["'](?:apple-touch-icon|manifest)["']/.test(html))throw Error('Existing app icon metadata must be reconciled before adding another');
html=html.replace('</head>',[
  '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-pure-kp-v1.png">',
  '<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-pure-kp-v1.png">',
  '<link rel="manifest" href="/site.webmanifest">',
  '<meta name="apple-mobile-web-app-title" content="KPMAP">'
].join('')+'</head>');
fs.writeFileSync(file,html);
console.log('Added KPMAP Pure KP home-screen artwork and manifest');
