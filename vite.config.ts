import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { parsePlugin } from './server/parsePlugin';
import { assistPlugin } from './server/assistPlugin';

// Build output lives in dist.nosync so iCloud does not sync it.
export default defineConfig({
  plugins: [
    react(),
    parsePlugin(),
    assistPlugin(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/*.png'],
      manifest: {
        name: 'Bench Flow',
        short_name: 'Bench Flow',
        description: 'Bench Flow: the open lab notebook for every bench. Free, offline-first, built for reproducible neuroscience.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#006747',
        background_color: '#F8FAFC',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
  },
});
