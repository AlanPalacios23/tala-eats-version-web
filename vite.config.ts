import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
