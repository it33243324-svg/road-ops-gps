const fs=require('node:fs'),path=require('node:path');
module.exports=function readRoutes(file='dist/index.html'){
  const html=fs.readFileSync(file,'utf8'),inline=html.match(/const D=(\{.*?\}),\$=x=>/s);
  if(inline)return JSON.parse(inline[1]);
  const script=html.match(/<script src="(\/assets\/[^" ]+)" id="kpmap-route-data"><\/script>/);
  if(!script)throw Error('Missing route data script');
  const content=fs.readFileSync(path.join(path.dirname(file),script[1]),'utf8');
  if(!content.startsWith('window.KPMAP_ROUTES=')||!content.endsWith(';'))throw Error('Invalid route data assignment');
  return JSON.parse(content.slice('window.KPMAP_ROUTES='.length,-1));
};
