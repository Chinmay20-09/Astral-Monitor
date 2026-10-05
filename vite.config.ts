import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// OrbitShield ST-02 — ground console entrypoint (:3000). All three operator
// screens are served from this single Vite app (root `/`, `/twin`, `/attacker`),
// all of which proxy /api back to the local security gateway backend (backend/ :4000).
// The twin (:3010) and attacker (:3500) configs act as UX proxies: each serves
// the same root app at its own port, so the shared frontend is just one app.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
