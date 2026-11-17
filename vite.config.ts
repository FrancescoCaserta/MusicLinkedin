import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from the site root locally; from a sub-path on GitHub Pages (set by the deploy workflow).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
