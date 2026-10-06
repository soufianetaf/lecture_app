/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Chemins relatifs : l'application fonctionne dans n'importe quel sous-dossier
  // (ex. GitHub Pages), la navigation passant par l'adresse (#/…).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Mise à jour proposée, jamais imposée : pas de rechargement en pleine lecture.
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Lecture',
        short_name: 'Lecture',
        description:
          'Lire des livres PDF, EPUB et TXT en français et en anglais : suivi, surlignage, dictionnaire et vocabulaire.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#fafaf9',
        theme_color: '#d97706',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout le code (y compris pdf.js et son worker) est mis en cache : lecture hors ligne.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // pdf.js pèse ~780 Ko à lui seul ; il n'est chargé qu'à l'ouverture d'un livre.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
  },
});
