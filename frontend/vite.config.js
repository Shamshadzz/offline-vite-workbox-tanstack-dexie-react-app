// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 🔥 KEY FIX: Use your custom service worker
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',

      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],

      manifest: {
        name: 'Offline Todo App',
        short_name: 'Todos',
        description: 'Offline-first todo application with sync capabilities',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Tell Workbox where to inject the manifest
        swSrc: 'src/service-worker.js',
        swDest: 'dist/service-worker.js',
        // This will replace self.__WB_MANIFEST with the actual file list
        injectionPoint: 'self.__WB_MANIFEST',

        // Additional Workbox config for injectManifest
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      },

      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],

  resolve: {
    alias: {
      '@': '/src'
    }
  },

  build: {
    target: 'esnext',
    sourcemap: true
  },

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://drv418m7-5000.inc1.devtunnels.ms',
        changeOrigin: true,
        secure: false
      }
    }
  }
})