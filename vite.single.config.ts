import { defineConfig } from 'vite';
import path from 'path';
import { singleFile } from './scripts/vite-plugin-single-file';

/**
 * Build: `npm run build:single` -> dist-single/index.html (one self-contained file).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '/assets': path.resolve(__dirname, './assets')
    }
  },
  publicDir: 'assets',
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    target: 'es2020',
    assetsDir: '.',
    reportCompressedSize: false
  },
  plugins: [
    singleFile({
      publicDir: 'assets',
      // Design-time metadata, nothing loads it at runtime.
      // og-cover.jpg is the link-preview image: it must stay an absolute URL in the
      // meta tags (a data: URI is useless to a scraper), so it is never inlined.
      // cover.jpg is the full-size master the preview image is cut from — 2 MB the
      // self-contained build has no use for.
      exclude: ['/sprites_metadata.json', '/og-cover.jpg', '/cover.jpg']
    })
  ]
});
