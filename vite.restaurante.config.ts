import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Build only the merchant HTML. Existing Kali Nginx 18197 serves
// /restaurante -> /restaurantes.html and rejects the generic /index.html.
export default defineConfig({
 plugins:[react()],
 build:{
  outDir:'dist-restaurantes',
  emptyOutDir:true,
  rollupOptions:{input:resolve(process.cwd(),'restaurantes.html')}
 }
});
