import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Glifon',
        short_name: 'Glifon',
        description: 'Express emotions, memories and creativity through digital glyphs.',
        theme_color: '#0b0b14',
        background_color: '#0b0b14',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: []
      },
      // custom service worker so we can show web push notifications
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js'
    })
  ]
});
