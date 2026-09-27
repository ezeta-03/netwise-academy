import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// En modo emulador (pruebas locales) se quita Google Tag Manager para que las
// pruebas no ensucien GA4.
const stripGtm = (mode) => ({
  name: 'strip-gtm-in-emulator',
  transformIndexHtml: (html) => mode === 'emulator'
    ? html.replace(/<!-- Google Tag Manager[\s\S]*?<!-- End Google Tag Manager[^>]*-->/g, '')
    : html,
})

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    stripGtm(mode),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro lo hace src/lib/swUpdate.js (recarga segura tras un deploy).
      injectRegister: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // index.html siempre se pide a la red primero (si hay conexión).
        navigateFallback: null,
        runtimeCaching: [
          { urlPattern: ({ request }) => request.mode === 'navigate', handler: 'NetworkFirst', options: { cacheName: 'pages', networkTimeoutSeconds: 4 } },
        ],
      },
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Netwise Academy',
        short_name: 'Netwise',
        description: 'Talleres prácticos de marketing digital, IA y emprendimiento con clases en vivo.',
        start_url: '/',
        id: '/',
        lang: 'es',
        display: 'standalone',
        background_color: '#151223',
        theme_color: '#151223',
        orientation: 'portrait-primary',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}))
