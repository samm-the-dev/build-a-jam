import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Local-only: trusted HTTPS via mkcert (skip in CI where certs aren't available)
    ...(!process.env.CI ? [mkcert()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/index.html',
        // Exercise JSON data pushes the main chunk past Workbox's 2 MB default
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Build-a-Jam',
        short_name: 'Build-a-Jam',
        description: 'Find and organize improv exercises for practice sessions',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // Custom domain (build-a-jam.app) serves from root — no path prefix needed
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
