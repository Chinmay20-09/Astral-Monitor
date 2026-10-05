import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// OrbitShield ST-02 — Attack Simulator screen (:3500).
// Serves the same root OrbitShield app from vite.config.ts at the attacker port.
// The shared root app reads activeScreen via the attacker entry (src/main.attacker.tsx).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3500,
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
