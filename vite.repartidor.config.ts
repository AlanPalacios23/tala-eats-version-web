import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

/** Separate entry, executable JS, service worker and origin for the driver role.
 * No customer App.tsx, checkout or RestaurantWorkspace is imported.
 */
export default defineConfig({
 plugins:[react(),{
  name:'tala-driver-review-marker',
  transformIndexHtml(html:string){
   return process.env.VITE_PREVIEW_READONLY==='true'
    ?html.replace('</head>','<meta name="tala-preview-mode" content="read-only"/></head>')
    :html;
  }
 }],
 build:{outDir:'dist-repartidores',emptyOutDir:true,
  rollupOptions:{input:resolve(process.cwd(),'repartidores.html')}},
 server:{proxy:{'/api/v1':{target:'https://talaeats.alan-palacios-dev.com',
   changeOrigin:true,secure:true}}}
});
