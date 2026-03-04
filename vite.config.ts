import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Custom domain (buildajam.app) serves from root — no path prefix needed
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // The exercise JSON data pushes the main chunk past 500 kB.
    // This is expected for bundled static data — suppress the warning.
    chunkSizeWarningLimit: 2200,
  },
  server: {
    port: 5173,
    strictPort: true, // Fail if port is in use instead of auto-incrementing
  },
});
