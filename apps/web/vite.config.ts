import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        id: '/',
        name: 'قیچی — مدیریت آرایشگاه',
        short_name: 'قیچی',
        description: 'مدیریت سالن، نوبت‌ها، مشتریان و گزارش درآمد',
        lang: 'fa',
        dir: 'rtl',
        display: 'standalone',
        start_url: '/dashboard',
        scope: '/',
        theme_color: '#173f31',
        background_color: '#f4f7f5',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'] },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
