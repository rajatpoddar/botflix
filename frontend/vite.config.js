import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'pwa-icon.svg', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'StreamX — Premium Streaming',
        short_name: 'StreamX',
        description: 'Stream your personal Jellyfin media collection from anywhere. Unlimited movies & TV shows.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/browse',
        scope: '/',
        lang: 'en',
        categories: ['entertainment', 'video', 'streaming'],
        shortcuts: [
          {
            name: 'Browse Movies',
            short_name: 'Movies',
            description: 'Browse your movie collection',
            url: '/browse/movies',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Browse TV Shows',
            short_name: 'TV Shows',
            description: 'Browse your TV show collection',
            url: '/browse/shows',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Watchlist',
            short_name: 'Watchlist',
            description: 'View your watchlist',
            url: '/browse/watchlist',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }],
          },
        ],
        screenshots: [],
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\.(?:mp4|webm|ogg|m3u8)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          {
            // Cache all API image requests
            urlPattern: /\/api\/media\/(?:image|public-image)\/[a-f0-9]+/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // expose on network for mobile testing
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
