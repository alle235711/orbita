import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serve l'app sotto /orbita/; in sviluppo resta alla radice.
const base = process.env.BASE_PATH ?? '/'

// Nessuna richiesta verso l'esterno: lo garantisce la CSP. Solo in build,
// perché in sviluppo il refresh di React usa uno script inline.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'orbita-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Orbita',
        short_name: 'Orbita',
        description: 'Le giornate fino alla laurea: studio, lavoro, sport e ripasso, anche offline.',
        lang: 'it',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#070A16',
        theme_color: '#070A16',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
