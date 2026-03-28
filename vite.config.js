import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base path for GitHub Pages deployment
  base: '/socc-route-finder/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'route-analyser': resolve(__dirname, 'route-analyser.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  }
});
