import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Existing Kali 18197 serves /restaurante -> /restaurantes.html.
// /release.json is intentionally NOT exposed by its isolated nginx; embed
// the exact build SHA in this public HTML for external no-cookie auditing.
const release=JSON.parse(readFileSync(resolve(process.cwd(),'public/release.json'),'utf8'));
const sha=release.source_sha;
if(typeof sha!=='string'||!/^[a-f0-9]{40}$/.test(sha)){
  throw new Error('RESTAURANTES_BUILD_ABORT=SOURCE_SHA_NOT_VERIFIED');
}
export default defineConfig({
 plugins:[react(),{
   name:'tala-restaurant-exact-sha',
   transformIndexHtml(html:string){
     return html.replace('</head>',`<meta name="tala-release-sha" content="${sha}"/></head>`);
   }
 }],
 build:{
  outDir:'dist-restaurantes',
  emptyOutDir:true,
  rollupOptions:{input:resolve(process.cwd(),'restaurantes.html')}
 }
});
