import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name:'tala-review-build-marker',
    transformIndexHtml(html:string){
      return process.env.VITE_PREVIEW_READONLY === 'true'
       ? html.replace('</head>','<meta name="tala-preview-mode" content="read-only" /></head>')
       : html;
    }
  }],
  server: {
    // HTTPS-compatible same-origin API proxy in development. No embedded secrets.
    proxy: {
      '/api/v1': {
        target: 'https://talaeats.alan-palacios-dev.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
