import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,normalize,resolve,sep} from 'node:path';
const root=resolve('dist-restaurantes');
const routeRoot=['/restaurante','/restaurante/acceso','/restaurante/alta','/admin/solicitudes-restaurantes','/admin/conectar-restaurante'];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.ttf':'font/ttf'};
const site=createServer(async(req,res)=>{
 const url=new URL(req.url??'/', 'http://127.0.0.1:4174');
 const path=url.pathname;
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 if(path==='/'){res.writeHead(302,{Location:'/restaurante'});res.end();return;}
 if(path==='/clientes'||path==='/iniciar'||path==='/sw.js'){res.writeHead(404);res.end();return;}
 if(path.startsWith('/api/')){res.writeHead(502);res.end();return;}
 const spa=routeRoot.some(r=>path===r||r==='/restaurante'&&path.startsWith('/restaurante/'));
 const file=spa?'restaurantes.html':decodeURIComponent(path).replace(/^\/+/, '');
 const full=resolve(root,normalize(file));
 if(!full.startsWith(root+sep)){res.writeHead(404);res.end();return;}
 try{
  const state=await stat(full);
  if(!state.isFile())throw new Error('not a file');
  const body=await readFile(full);
  res.writeHead(200,{'Content-Type':types[extname(full)]??'application/octet-stream','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404);res.end();}
});
site.listen(4174,'127.0.0.1',()=>console.log('MERCHANT_ONLY_QA_SERVER=http://127.0.0.1:4174'));
