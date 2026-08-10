import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves from /<repo>/, local dev from /.
  base: process.env.BASE_PATH || '/',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
});
