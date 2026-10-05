import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// OrbitShield ST-02 — Attack Simulator screen (:3500).
// Serves the same root OrbitShield app from vite.config.ts at the attacker port.
// The shared root app reads activeScreen via the attacker entry (src/main.attacker.tsx).
//
// SECURITY: Attacker is UNTRUSTED. No proxy to backend.
// The attacker simulator generates attack scenarios client-side
// and demonstrates what untrusted access looks like.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3500,
    host: true,
    // NO /api proxy — attacker must not reach backend directly
    // Attacker simulates attacks through its own UI only
    cors: {
      origin: 'http://localhost:3500',
      methods: ['GET', 'POST'],
      credentials: true
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
