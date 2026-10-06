import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Only run tests in src/ and backend/src/ (exclude node_modules and standalone scripts)
    include: ['src/tests/**/*.test.ts', 'backend/src/tests/**/*.test.ts'],
    exclude: ['src/tests/security_pipeline.test.ts'],
  },
});
