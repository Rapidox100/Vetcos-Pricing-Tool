import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client builds into server/public which Express serves in production.
// In dev, Vite runs on 5173 and proxies /api to the Express server on 3000.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
