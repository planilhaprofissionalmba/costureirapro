import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'favicon-16.png',
        'favicon-32.png',
        'logo-pp.png',
        'logo-pp.jpg',
        'app-icon.svg',
        'app-icon.png',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
      ],
      manifest: {
        name: 'CostureiraPro',
        short_name: 'CostureiraPro',
        description: 'Agenda, costuras, clientes, estoque e caixa do seu ateliê — Planilha Profissional',
        theme_color: '#184A4E',
        background_color: '#FFFCF2',
        display: 'standalone',
        start_url: '/',
        id: '/',
        lang: 'pt-BR',
        // Permite ao Chrome/Edge responder getInstalledRelatedApps() numa aba comum (botão mostra "já instalado").
        related_applications: [
          { platform: 'webapp', url: 'https://costureirapro.planilhaprofissional.com/manifest.webmanifest' },
        ],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
})
