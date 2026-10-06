import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// OrbitShield ST-02 — Attack Simulator screen (:3500).
// Serves the same root OrbitShield app from vite.config.ts at the attacker port.
// The shared root app reads activeScreen via the attacker entry (src/main.attacker.tsx).
//
// SECURITY: Attacker is UNTRUSTED.
// - Attacker CAN send attack commands to backend /api/commands (for detection/blocking demo)
// - Attacker CANNOT access trusted endpoints that require origin validation
// - The security middleware will block unauthorized access and generate security events
// - This demonstrates the attacker being detected and blocked by the security layer
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3500,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        // Attacker sends from untrusted origin; security middleware handles blocking
        headers: {
          Origin: 'http://localhost:3500'
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
