import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Weaviate Manager',
        short_name: 'Weaviate',
        description: 'Visual management console for Weaviate vector databases',
        theme_color: '#1677ff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // React 核心
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // Ant Design
          if (id.includes('node_modules/antd') ||
              id.includes('node_modules/@ant-design')) {
            return 'vendor-antd';
          }
          // Zustand
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          // Monaco Editor 自动分包（React.lazy 触发）
          if (id.includes('node_modules/monaco-editor')) {
            return 'vendor-monaco';
          }
          // Charts
          if (id.includes('node_modules/@ant-design/charts') ||
              id.includes('node_modules/@antv')) {
            return 'vendor-charts';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
