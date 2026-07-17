import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg', 'icons.svg'],
      manifest: {
        name: 'Weaviate Manager',
        short_name: 'Weaviate',
        description: 'Visual management console for Weaviate vector databases',
        theme_color: '#6C5CE7',
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
          // Ant Design 图标库（体积大，单独拆出）
          if (id.includes('node_modules/@ant-design/icons')) {
            return 'vendor-icons';
          }
          // Ant Design 组件
          if (id.includes('node_modules/antd') ||
              id.includes('node_modules/@ant-design')) {
            return 'vendor-antd';
          }
          // Zustand
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          // Monaco Editor 本体（懒加载）
          if (id.includes('node_modules/monaco-editor')) {
            return 'vendor-monaco';
          }
          // Monaco React 包装（懒加载）
          if (id.includes('node_modules/@monaco-editor')) {
            return 'vendor-monaco-react';
          }
          // Diff Viewer（懒加载）
          if (id.includes('node_modules/react-diff-viewer') ||
              id.includes('node_modules/@emotion')) {
            return 'vendor-diff';
          }
          // Charts
          if (id.includes('node_modules/@ant-design/charts') ||
              id.includes('node_modules/@antv')) {
            return 'vendor-charts';
          }
          // Weaviate client
          if (id.includes('node_modules/weaviate-ts-client')) {
            return 'vendor-weaviate';
          }
        },
      },
    },
    chunkSizeWarningLimit: 5000,
  },
})
