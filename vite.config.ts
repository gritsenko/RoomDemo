import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Relative base: the same build works at '/', at '/RoomDemo/' and from file://
  base: './',
  server: {
    port: 3000,
    open: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '/assets': path.resolve(__dirname, './assets')
    }
  },
  publicDir: 'assets'
});
