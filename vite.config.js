import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Firebase is most of the bundle and changes far less often than app code —
        // splitting it keeps app updates from busting the big vendor chunk.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Planner',
        short_name: 'Planner',
        description: 'Daily planner with time blocks and recurring tasks',
        theme_color: '#FFDFAF',
        background_color: '#FFDFAF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // woff2 matters: the fonts are self-hosted precisely so they work
        // offline, which only holds if they're in the precache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        // Fontsource ships every subset. unicode-range means a browser only
        // fetches what it needs, but the precache would take all of them —
        // so keep the non-latin subsets network-only.
        globIgnores: [
          '**/*-cyrillic-*.woff2',
          '**/*-greek-*.woff2',
          '**/*-vietnamese-*.woff2',
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
})
