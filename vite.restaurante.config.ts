import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

/** A real merchant-only Vite entry: customer components aren't even imported.
 * The existing Vite build and index.html are retained for Pedir comida.
 */
export default defineConfig({
 plugins:[react(),{
  name:'tala-merchant-preview-marker',
  transformIndexHtml(html:string){
   return process.env.VITE_PREVIEW_READONLY==='true'
    ?html.replace('</head>','<meta name="tala-preview-mode" content="read-only" /></head>')
    :html;
  }
 }],
 build:{
  outDir:'dist-restaurantes',
  emptyOutDir:true,
  rollupOptions:{input:resolve(process.cwd(),'restaurantes.html')}
 },
 server:{
  proxy:{'/api/v1':{
   target:'https://talaeats.alan-palacios-dev.com',
   changeOrigin:true,secure:true
  }}
 }
});
