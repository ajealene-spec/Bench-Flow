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
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Lab Companion',
        short_name: 'Lab Companion',
        description: 'Offline-first guided lab procedures',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
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
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
